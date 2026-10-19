import type { NftCollectionId, NftNetwork, NftSort } from '@/lib/catalog-options'

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
  network: NftNetwork
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
  minPrice: number
  maxPrice: number
  network?: NftNetwork
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

export type User = {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export type AuthResponse = {
  user: User
  token: string
}

export type SessionResponse = {
  user: User
}

export type FavoritesResponse = {
  items: string[]
}

export type FavoriteMutationResponse = {
  success: boolean
  nftId: string
  items: string[]
}

export type AccountResponse = {
  user: User
}

export type LoginPayload = {
  email: string
  password?: string
}

export type RegisterPayload = {
  name: string
  email: string
  password?: string
}

export type CartItem = {
  id: string // composite key, e.g. `${nftId}:${editionId}`
  nftId: string
  editionId: string
  name: string
  collectionName: string
  imageUrl: string
  editionName: string
  editionNumber: string
  unitPriceEth: string
  quantity: number
  available: number
  subtotalEth: string
  priceChanged?: boolean
  stockChanged?: boolean
  originalPriceEth?: string
  originalAvailable?: number
}

export type CartCoupon = {
  code: string
  discountPercent: number
  discountEth: string
}

export type CartQuoteConflict = {
  type: 'price_changed' | 'stock_exceeded' | 'item_unavailable'
  nftId: string
  editionId: string
  message: string
}

export type CartQuote = {
  id: string
  items: CartItem[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  coupon: CartCoupon | null
  validUntil: string
  isValid: boolean
  conflicts: CartQuoteConflict[]
}

export type CartResponse = {
  items: CartItem[]
  totalItems: number
  totalQuantity: number
  coupon: CartCoupon | null
}

export type AddCartItemPayload = {
  nftId: string
  editionId?: string
  quantity?: number
}

export type UpdateCartItemPayload = {
  quantity: number
}

export type ApplyCouponPayload = {
  code: string
}

export type MergeCartPayload = {
  guestId: string
}

export type MergeCartResponse = {
  success: boolean
  items: CartItem[]
  conflicts: CartQuoteConflict[]
}
