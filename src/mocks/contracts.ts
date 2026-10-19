import type { NftCollectionId, NftSort } from '@/lib/catalog-options'

export type HealthResponse = {
  status: 'ok'
  service: string
  checkedAt: string
}

export type NftEdition = {
  id: string
  name: string
  editionNumber: string
  supply: number
  priceEth: string
  available: number
}

export type Nft = {
  id: string
  name: string
  collection: { id: NftCollectionId; name: string }
  creator: string
  description: string
  imageUrl: string
  createdAt: string
  editions: NftEdition[]
  version: number
}

export type NftListItem = Nft & {
  priceEth: string
  available: number
  availableEditionCount: number
}

export type NftListParams = {
  q: string
  collection?: NftCollectionId
  available?: boolean
  sort: NftSort
  page: number
  pageSize: number
}

export type NftListResponse = {
  items: NftListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ApiError = { message: string }

export type NftUpdatedEvent = {
  nftId: string
  priceEth: string
  available: number
  version: number
}
