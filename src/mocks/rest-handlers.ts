import { http, HttpResponse } from 'msw'
import type { HealthResponse, NftListParams, NftUpdatedEvent } from './contracts'
import { nftFixtures, summarizeNft, updateNftFixture } from './fixtures/nfts'
import { mockStore } from './mock-store'
import { emitNftUpdateToClients } from './socket-handlers'

function readPositiveInteger(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}

function parseListParams(request: Request): NftListParams {
  const url = new URL(request.url)
  const sort = url.searchParams.get('sort')
  const collection = url.searchParams.get('collection')
  const available = url.searchParams.get('available')
  const network = url.searchParams.get('network')
  const rawMinPrice = Number(url.searchParams.get('minPrice'))
  const rawMaxPrice = Number(url.searchParams.get('maxPrice'))

  return {
    q: url.searchParams.get('q')?.trim() ?? '',
    collection: collection === 'aurora' || collection === 'afterlight' || collection === 'flora'
      ? collection
      : undefined,
    available: available === 'true' || available === '1' ? true : undefined,
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    minPrice: Number.isFinite(rawMinPrice) && rawMinPrice >= 0.02 ? rawMinPrice : 0.02,
    maxPrice: Number.isFinite(rawMaxPrice) && rawMaxPrice <= 12.3 ? rawMaxPrice : 12.3,
    network: network === 'ethereum' || network === 'polygon' || network === 'solana' ? network : undefined,
    page: readPositiveInteger(url.searchParams.get('page'), 1, 100),
    pageSize: readPositiveInteger(url.searchParams.get('pageSize'), 6, 24),
  }
}

function listNfts(params: NftListParams) {
  const query = params.q.toLocaleLowerCase()
  const filtered = nftFixtures
    .filter((nft) => !params.collection || nft.collection.id === params.collection)
    .map(summarizeNft)
    .filter((nft) => nft.network === params.network || !params.network)
    .filter((nft) => Number(nft.priceEth) >= params.minPrice && Number(nft.priceEth) <= params.maxPrice)
    .filter((nft) => {
      if (params.available && nft.available === 0) return false
      if (!query) return true
      return [nft.name, nft.collection.name, nft.creator].some((field) => field.toLocaleLowerCase().includes(query))
    })

  filtered.sort((a, b) => {
    if (params.sort === 'price-asc') return Number(a.priceEth) - Number(b.priceEth)
    if (params.sort === 'price-desc') return Number(b.priceEth) - Number(a.priceEth)
    return b.createdAt.localeCompare(a.createdAt)
  })

  const total = filtered.length
  const start = (params.page - 1) * params.pageSize

  return {
    items: filtered.slice(start, start + params.pageSize),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

function extractOwnerId(request: Request): string {
  const token = extractBearerToken(request)
  if (token) {
    const session = mockStore.getSession(token)
    if (session && !session.expired) {
      return session.user.id
    }
  }
  const guestHeader = request.headers.get('X-Guest-Id')
  return guestHeader && guestHeader.trim() ? guestHeader.trim() : 'guest-default'
}

export const restHandlers = [
  http.get('/api/health', () => {
    const response: HealthResponse = {
      status: 'ok',
      service: 'nft-marketplace-mock-api',
      checkedAt: new Date().toISOString(),
    }

    return HttpResponse.json(response)
  }),

  http.get('/api/nfts', ({ request }) => {
    if (mockStore.checkAndConsumeFailNextNftList()) {
      return HttpResponse.json({ message: 'Não foi possível carregar o catálogo.' }, { status: 503 })
    }

    const params = parseListParams(request)
    return HttpResponse.json(listNfts(params))
  }),

  http.get('/api/nfts/:nftId', ({ params }) => {
    const nft = nftFixtures.find((item) => item.id === params.nftId)
    if (!nft) return HttpResponse.json({ message: 'NFT não encontrado.' }, { status: 404 })
    return HttpResponse.json(nft)
  }),

  // Auth endpoints
  http.post('/api/auth/register', async ({ request }) => {
    try {
      const body = (await request.json()) as { name?: string; email?: string; password?: string }
      const { name, email, password } = body

      if (!name || name.trim().length < 2) {
        return HttpResponse.json({ message: 'O nome deve ter no mínimo 2 caracteres.' }, { status: 400 })
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return HttpResponse.json({ message: 'E-mail inválido.' }, { status: 400 })
      }
      if (!password || password.length < 6) {
        return HttpResponse.json({ message: 'A senha deve conter no mínimo 6 caracteres.' }, { status: 400 })
      }

      const result = mockStore.registerUser(name, email, password)
      return HttpResponse.json(result, { status: 201 })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar a conta.'
      return HttpResponse.json({ message }, { status: 409 })
    }
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    const { email = '', password = '' } = body

    if (!email || !password) {
      return HttpResponse.json({ message: 'Informe e-mail e senha.' }, { status: 400 })
    }

    const result = mockStore.validateCredentials(email, password)
    if (!result) {
      return HttpResponse.json({ message: 'Credenciais inválidas.' }, { status: 401 })
    }

    return HttpResponse.json(result)
  }),

  http.get('/api/auth/session', ({ request }) => {
    const token = extractBearerToken(request)
    if (!token) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }

    const session = mockStore.getSession(token)
    if (!session) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }
    if (session.expired) {
      return HttpResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
    }

    return HttpResponse.json({ user: session.user })
  }),

  http.post('/api/auth/logout', ({ request }) => {
    const token = extractBearerToken(request)
    if (token) {
      mockStore.deleteSession(token)
    }
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/account', ({ request }) => {
    const token = extractBearerToken(request)
    if (!token) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }

    const session = mockStore.getSession(token)
    if (!session) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }
    if (session.expired) {
      return HttpResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
    }

    return HttpResponse.json({ user: session.user })
  }),

  // Favorites endpoints
  http.get('/api/favorites', ({ request }) => {
    const token = extractBearerToken(request)
    if (!token) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }

    const session = mockStore.getSession(token)
    if (!session) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }
    if (session.expired) {
      return HttpResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
    }

    const items = mockStore.getUserFavorites(session.user.id)
    return HttpResponse.json({ items })
  }),

  http.post('/api/favorites', async ({ request }) => {
    const token = extractBearerToken(request)
    if (!token) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }

    const session = mockStore.getSession(token)
    if (!session) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }
    if (session.expired) {
      return HttpResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
    }

    if (mockStore.checkAndConsumeFailNextFavorite()) {
      return HttpResponse.json({ message: 'Falha ao atualizar favoritos.' }, { status: 500 })
    }

    const body = (await request.json()) as { nftId?: string }
    const nftId = body.nftId
    if (!nftId) {
      return HttpResponse.json({ message: 'Identificador da obra é obrigatório.' }, { status: 400 })
    }

    const items = mockStore.addFavorite(session.user.id, nftId)
    return HttpResponse.json({ success: true, nftId, items })
  }),

  http.delete('/api/favorites/:nftId', ({ request, params }) => {
    const token = extractBearerToken(request)
    if (!token) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }

    const session = mockStore.getSession(token)
    if (!session) {
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 })
    }
    if (session.expired) {
      return HttpResponse.json({ message: 'Sessão expirada.' }, { status: 401 })
    }

    if (mockStore.checkAndConsumeFailNextFavorite()) {
      return HttpResponse.json({ message: 'Falha ao atualizar favoritos.' }, { status: 500 })
    }

    const nftId = String(params.nftId)
    const items = mockStore.removeFavorite(session.user.id, nftId)
    return HttpResponse.json({ success: true, nftId, items })
  }),

  // Cart endpoints
  http.get('/api/cart', ({ request }) => {
    const ownerId = extractOwnerId(request)
    return HttpResponse.json(mockStore.getCart(ownerId))
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const ownerId = extractOwnerId(request)
    try {
      const body = (await request.json()) as { nftId?: string; editionId?: string; quantity?: number }
      if (!body.nftId) {
        return HttpResponse.json({ message: 'Identificador da obra é obrigatório.' }, { status: 400 })
      }
      const cart = mockStore.addToCart(ownerId, {
        nftId: body.nftId,
        editionId: body.editionId,
        quantity: body.quantity,
      })
      return HttpResponse.json(cart, { status: 201 })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível adicionar o item.'
      return HttpResponse.json({ message }, { status: 400 })
    }
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const ownerId = extractOwnerId(request)
    try {
      const body = (await request.json()) as { quantity?: number }
      if (body.quantity === undefined) {
        return HttpResponse.json({ message: 'Quantidade é obrigatória.' }, { status: 400 })
      }
      const cart = mockStore.updateCartItemQuantity(ownerId, String(params.itemId), body.quantity)
      return HttpResponse.json(cart)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar a quantidade.'
      return HttpResponse.json({ message }, { status: 400 })
    }
  }),

  http.delete('/api/cart/items/:itemId', ({ request, params }) => {
    const ownerId = extractOwnerId(request)
    const cart = mockStore.removeFromCart(ownerId, String(params.itemId))
    return HttpResponse.json(cart)
  }),

  http.delete('/api/cart', ({ request }) => {
    const ownerId = extractOwnerId(request)
    const cart = mockStore.clearCart(ownerId)
    return HttpResponse.json(cart)
  }),

  http.get('/api/cart/quote', ({ request }) => {
    const ownerId = extractOwnerId(request)
    try {
      const quote = mockStore.getQuote(ownerId)
      return HttpResponse.json(quote)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao calcular cotação.'
      return HttpResponse.json({ message }, { status: 503 })
    }
  }),

  http.post('/api/cart/coupon', async ({ request }) => {
    const ownerId = extractOwnerId(request)
    try {
      const body = (await request.json()) as { code?: string }
      if (!body.code) {
        return HttpResponse.json({ message: 'Informe o código do cupom.' }, { status: 400 })
      }
      const result = mockStore.applyCoupon(ownerId, body.code)
      return HttpResponse.json(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível aplicar o cupom.'
      return HttpResponse.json({ message }, { status: 400 })
    }
  }),

  http.delete('/api/cart/coupon', ({ request }) => {
    const ownerId = extractOwnerId(request)
    const cart = mockStore.removeCoupon(ownerId)
    return HttpResponse.json(cart)
  }),

  http.post('/api/cart/merge', async ({ request }) => {
    const ownerId = extractOwnerId(request)
    try {
      const body = (await request.json()) as { guestId?: string }
      const guestId = body.guestId ?? ''
      const result = mockStore.mergeCarts(ownerId, guestId)
      return HttpResponse.json(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao mesclar o carrinho.'
      return HttpResponse.json({ message }, { status: 400 })
    }
  }),

  // Scenario control endpoints
  http.post('/api/_mock/scenarios/nft-list-error-once', () => {
    mockStore.setFailNextNftList(true)
    return HttpResponse.json({ enabled: true })
  }),

  http.post('/api/_mock/scenarios/expire-session', () => {
    mockStore.setForceSessionExpired(true)
    return HttpResponse.json({ enabled: true })
  }),

  http.post('/api/_mock/scenarios/favorites-fail-once', () => {
    mockStore.setFailNextFavorite(true)
    return HttpResponse.json({ enabled: true })
  }),

  http.post('/api/_mock/scenarios/cart-quote-error-once', () => {
    mockStore.setFailNextQuote(true)
    return HttpResponse.json({ enabled: true })
  }),

  http.post('/api/_mock/scenarios/emit-nft-update', async ({ request }) => {
    try {
      const body = (await request.json()) as {
        nftId: string
        priceEth?: string
        available?: number
        editionId?: string
        version?: number
      }
      const updated = updateNftFixture(body.nftId, body)
      if (!updated) {
        return HttpResponse.json({ message: 'NFT não encontrado para atualização.' }, { status: 404 })
      }
      mockStore.setNftOverride(body.nftId, body)

      const edition = updated.editions.find((e) => e.id === (body.editionId ?? 'open')) ?? updated.editions[0]
      const event: NftUpdatedEvent = {
        nftId: updated.id,
        priceEth: edition ? edition.priceEth : (body.priceEth ?? '1.0'),
        available: edition ? edition.available : (body.available ?? 1),
        version: updated.version,
      }

      emitNftUpdateToClients(event)
      return HttpResponse.json({ success: true, event, nft: updated })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao emitir evento de teste.'
      return HttpResponse.json({ message }, { status: 400 })
    }
  }),

  http.post('/api/_mock/scenarios/reset', () => {
    mockStore.reset()
    return HttpResponse.json({ reset: true })
  }),
]
