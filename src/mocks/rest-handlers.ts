import { http, HttpResponse } from 'msw'
import type { HealthResponse, NftListParams } from './contracts'
import { nftFixtures, summarizeNft } from './fixtures/nfts'
import { mockStore } from './mock-store'

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

  http.post('/api/_mock/scenarios/reset', () => {
    mockStore.reset()
    return HttpResponse.json({ reset: true })
  }),
]
