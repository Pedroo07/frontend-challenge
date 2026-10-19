export const nftCollections = [
  { id: 'aurora', name: 'Aurora' },
  { id: 'afterlight', name: 'Afterlight' },
  { id: 'flora', name: 'Forma Flora' },
] as const

export type NftCollectionId = (typeof nftCollections)[number]['id']
export type NftSort = 'newest' | 'price-asc' | 'price-desc'

export const nftSortOptions: { value: NftSort; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
]

export const nftPageSize = 6

export type CatalogSearch = {
  q: string
  collection: 'all' | NftCollectionId
  available: boolean
  sort: NftSort
  page: number
}

export const catalogSearchDefaults: CatalogSearch = {
  q: '',
  collection: 'all',
  available: false,
  sort: 'newest',
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

export function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  return {
    q: typeof search.q === 'string' ? search.q.trim().slice(0, 80) : '',
    collection: isCollectionId(search.collection) ? search.collection : 'all',
    available: parseBoolean(search.available),
    sort: isNftSort(search.sort) ? search.sort : 'newest',
    page: parsePage(search.page),
  }
}

export function formatEth(price: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(price))
}
