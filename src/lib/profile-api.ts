import { http } from './http'
import type {
  AddWalletPayload,
  ChangePasswordPayload,
  OrderStatus,
  OrdersListResponse,
  UpdateProfilePayload,
  User,
  Wallet,
  WalletsResponse,
} from '@/mocks/contracts'

export async function fetchAccount(signal?: AbortSignal): Promise<{ user: User }> {
  const response = await http.get<{ user: User }>('/api/account', { signal })
  return response.data
}

export async function updateAccount(payload: UpdateProfilePayload): Promise<{ user: User }> {
  const response = await http.patch<{ user: User }>('/api/account', payload)
  return response.data
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ success: boolean; message: string }> {
  const response = await http.post<{ success: boolean; message: string }>('/api/account/password', payload)
  return response.data
}

export async function fetchUserOrders(
  status?: OrderStatus,
  signal?: AbortSignal,
): Promise<OrdersListResponse> {
  const params = status ? { status } : undefined
  const response = await http.get<OrdersListResponse>('/api/orders', {
    params,
    signal,
  })
  return response.data
}

export async function fetchUserWallets(signal?: AbortSignal): Promise<WalletsResponse> {
  const response = await http.get<WalletsResponse>('/api/wallets', { signal })
  return response.data
}

export async function addUserWallet(payload: AddWalletPayload): Promise<Wallet> {
  const response = await http.post<Wallet>('/api/wallets', payload)
  return response.data
}

export async function setPrimaryWallet(walletId: string): Promise<Wallet> {
  const response = await http.patch<Wallet>(`/api/wallets/${walletId}/primary`)
  return response.data
}

export async function removeUserWallet(walletId: string): Promise<{ success: boolean }> {
  const response = await http.delete<{ success: boolean }>(`/api/wallets/${walletId}`)
  return response.data
}
