import { http } from './http'
import type {
  AddCartItemPayload,
  CartCoupon,
  CartQuote,
  CartResponse,
  MergeCartResponse,
} from '@/mocks/contracts'

export async function fetchCart(signal?: AbortSignal): Promise<CartResponse> {
  const response = await http.get<CartResponse>('/api/cart', { signal })
  return response.data
}

export async function addCartItem(payload: AddCartItemPayload): Promise<CartResponse> {
  const response = await http.post<CartResponse>('/api/cart/items', payload)
  return response.data
}

export async function updateCartQuantity(itemId: string, quantity: number): Promise<CartResponse> {
  const response = await http.patch<CartResponse>(`/api/cart/items/${encodeURIComponent(itemId)}`, { quantity })
  return response.data
}

export async function removeCartItem(itemId: string): Promise<CartResponse> {
  const response = await http.delete<CartResponse>(`/api/cart/items/${encodeURIComponent(itemId)}`)
  return response.data
}

export async function clearAllCart(): Promise<CartResponse> {
  const response = await http.delete<CartResponse>('/api/cart')
  return response.data
}

export async function fetchCartQuote(signal?: AbortSignal): Promise<CartQuote> {
  const response = await http.get<CartQuote>('/api/cart/quote', { signal })
  return response.data
}

export async function applyCartCoupon(code: string): Promise<{ coupon: CartCoupon }> {
  const response = await http.post<{ coupon: CartCoupon }>('/api/cart/coupon', { code })
  return response.data
}

export async function removeCartCoupon(): Promise<CartResponse> {
  const response = await http.delete<CartResponse>('/api/cart/coupon')
  return response.data
}

export async function mergeCartWithAccount(guestId: string): Promise<MergeCartResponse> {
  const response = await http.post<MergeCartResponse>('/api/cart/merge', { guestId })
  return response.data
}

export async function triggerMockNftUpdate(payload: {
  nftId: string
  priceEth?: string
  available?: number
  editionId?: string
  version?: number
}): Promise<void> {
  await http.post('/api/_mock/scenarios/emit-nft-update', payload)
}
