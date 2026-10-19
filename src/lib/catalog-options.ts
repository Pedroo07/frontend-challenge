export const nftCollections = [
  { id: 'aurora', name: 'Aurora' },
  { id: 'afterlight', name: 'Afterlight' },
  { id: 'flora', name: 'Forma Flora' },
] as const

export type NftCollectionId = (typeof nftCollections)[number]['id']
export type NftSort = 'newest' | 'price-asc' | 'price-desc'
export const nftNetworks = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'solana', name: 'Solana' },
] as const
export type NftNetwork = (typeof nftNetworks)[number]['id']

export const nftSortOptions: { value: NftSort; label: string }[] = [
  { value: 'newest', label: 'Listados recentemente' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
]

export const nftPageSize = 9

export type CatalogSearch = {
  q: string
  collection: 'all' | NftCollectionId
  available: boolean
  sort: NftSort
  minPrice: number
  maxPrice: number
  network: 'all' | NftNetwork
  page: number
}

export const catalogSearchDefaults: CatalogSearch = {
  q: '',
  collection: 'all',
  available: false,
  sort: 'newest',
  minPrice: 0.02,
  maxPrice: 12.3,
  network: 'all',
  page: 1,
}

function isCollectionId(value: unknown): value is NftCollectionId {
  return typeof value === 'string' && nftCollections.some((collection) => collection.id === value)
}

function isNftSort(value: unknown): value is NftSort {
  return value === 'newest' || value === 'price-asc' || value === 'price-desc'
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1'
}

function parsePage(value: unknown): number {
  const page = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(page) && page > 0 && page <= 100 ? page : 1
}

function parsePrice(value: unknown, fallback: number): number {
  const price = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(price) && price >= 0.02 && price <= 12.3 ? Math.round(price * 100) / 100 : fallback
}

function isNftNetwork(value: unknown): value is NftNetwork {
  return typeof value === 'string' && nftNetworks.some((network) => network.id === value)
}

export function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const minPrice = parsePrice(search.minPrice, catalogSearchDefaults.minPrice)
  const maxPrice = parsePrice(search.maxPrice, catalogSearchDefaults.maxPrice)
  return {
    q: typeof search.q === 'string' ? search.q.trim().slice(0, 80) : '',
    collection: isCollectionId(search.collection) ? search.collection : 'all',
    available: parseBoolean(search.available),
    sort: isNftSort(search.sort) ? search.sort : 'newest',
    minPrice: minPrice <= maxPrice ? minPrice : catalogSearchDefaults.minPrice,
    maxPrice: maxPrice >= minPrice ? maxPrice : catalogSearchDefaults.maxPrice,
    network: isNftNetwork(search.network) ? search.network : 'all',
    page: parsePage(search.page),
  }
}

export function formatEth(price: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(price))
}
