import { http, HttpResponse } from 'msw'
import type { HealthResponse, NftListParams } from './contracts'
import { nftFixtures, summarizeNft } from './fixtures/nfts'

let failNextNftListRequest = false

function readPositiveInteger(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}

function parseListParams(request: Request): NftListParams {
  const url = new URL(request.url)
  const sort = url.searchParams.get('sort')
  const collection = url.searchParams.get('collection')
  const available = url.searchParams.get('available')

  return {
    q: url.searchParams.get('q')?.trim() ?? '',
    collection: collection === 'aurora' || collection === 'afterlight' || collection === 'flora'
      ? collection
      : undefined,
    available: available === 'true' || available === '1' ? true : undefined,
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    page: readPositiveInteger(url.searchParams.get('page'), 1, 100),
    pageSize: readPositiveInteger(url.searchParams.get('pageSize'), 6, 24),
  }
}

function listNfts(params: NftListParams) {
  const query = params.q.toLocaleLowerCase()
  const filtered = nftFixtures
    .filter((nft) => !params.collection || nft.collection.id === params.collection)
    .map(summarizeNft)
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
    if (failNextNftListRequest) {
      failNextNftListRequest = false
      return HttpResponse.json({ message: 'Não foi possível carregar o catálogo.' }, { status: 503 })
    }

    const params = parseListParams(request)
    return HttpResponse.json(listNfts(params))
  }),
  http.post('/api/_mock/scenarios/nft-list-error-once', () => {
    failNextNftListRequest = true
    return HttpResponse.json({ enabled: true })
  }),
  http.get('/api/nfts/:nftId', ({ params }) => {
    const nft = nftFixtures.find((item) => item.id === params.nftId)
    if (!nft) return HttpResponse.json({ message: 'NFT não encontrado.' }, { status: 404 })
    return HttpResponse.json(nft)
  }),
]
