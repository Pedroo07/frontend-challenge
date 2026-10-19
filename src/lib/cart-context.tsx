import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useAuth } from './auth-context'
import {
  addCartItem,
  applyCartCoupon,
  clearAllCart,
  fetchCart,
  fetchCartQuote,
  removeCartCoupon,
  removeCartItem,
  updateCartQuantity,
} from './cart-api'
import type { AddCartItemPayload, CartCoupon, CartItem, CartQuote } from '@/mocks/contracts'

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  totalQuantity: number
  coupon: CartCoupon | null
  quote: CartQuote | null
  isLoading: boolean
  isQuoteLoading: boolean
  quoteError: string | null
  addItem: (payload: AddCartItemPayload) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => Promise<void>
  refetchQuote: () => Promise<void>
  isMutating: boolean
  mutationError: string | null
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userScope = user?.id ?? 'guest'

  const cartQuery = useQuery({
    queryKey: ['cart', userScope],
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 10_000,
  })

  const quoteQuery = useQuery({
    queryKey: ['cart', 'quote', userScope],
    queryFn: ({ signal }) => fetchCartQuote(signal),
    staleTime: 0,
    retry: false,
  })

  const invalidateCartAndQuote = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cart'] }),
      queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] }),
    ])
  }, [queryClient])

  const addMutation = useMutation({
    mutationFn: addCartItem,
    onSuccess: invalidateCartAndQuote,
  })

  const updateQtyMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartQuantity(itemId, quantity),
    onSuccess: invalidateCartAndQuote,
  })

  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: invalidateCartAndQuote,
  })

  const clearMutation = useMutation({
    mutationFn: clearAllCart,
    onSuccess: invalidateCartAndQuote,
  })

  const couponMutation = useMutation({
    mutationFn: applyCartCoupon,
    onSuccess: invalidateCartAndQuote,
  })

  const removeCouponMutation = useMutation({
    mutationFn: removeCartCoupon,
    onSuccess: invalidateCartAndQuote,
  })

  const addItem = useCallback(
    async (payload: AddCartItemPayload) => {
      await addMutation.mutateAsync(payload)
    },
    [addMutation],
  )

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      await updateQtyMutation.mutateAsync({ itemId, quantity })
    },
    [updateQtyMutation],
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      await removeMutation.mutateAsync(itemId)
    },
    [removeMutation],
  )

  const clearCart = useCallback(async () => {
    await clearMutation.mutateAsync()
  }, [clearMutation])

  const applyCoupon = useCallback(
    async (code: string) => {
      await couponMutation.mutateAsync(code)
    },
    [couponMutation],
  )

  const removeCoupon = useCallback(async () => {
    await removeCouponMutation.mutateAsync()
  }, [removeCouponMutation])

  const refetchQuote = useCallback(async () => {
    await quoteQuery.refetch()
  }, [quoteQuery])

  const items = useMemo(() => cartQuery.data?.items ?? [], [cartQuery.data?.items])
  const totalItems = cartQuery.data?.totalItems ?? items.length
  const totalQuantity = cartQuery.data?.totalQuantity ?? items.reduce((s, i) => s + i.quantity, 0)
  const coupon = cartQuery.data?.coupon ?? quoteQuery.data?.coupon ?? null

  const isMutating =
    addMutation.isPending ||
    updateQtyMutation.isPending ||
    removeMutation.isPending ||
    clearMutation.isPending ||
    couponMutation.isPending ||
    removeCouponMutation.isPending

  const mutationError = useMemo(() => {
    const error =
      addMutation.error ||
      updateQtyMutation.error ||
      removeMutation.error ||
      clearMutation.error ||
      couponMutation.error ||
      removeCouponMutation.error

    if (!error) return null
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      return String(error.response.data.message)
    }
    return error instanceof Error ? error.message : 'Falha na operação.'
  }, [
    addMutation.error,
    updateQtyMutation.error,
    removeMutation.error,
    clearMutation.error,
    couponMutation.error,
    removeCouponMutation.error,
  ])

  const quoteError = useMemo(() => {
    if (!quoteQuery.isError) return null
    const error = quoteQuery.error
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      return String(error.response.data.message)
    }
    return error instanceof Error ? error.message : 'Falha ao obter cotação oficial.'
  }, [quoteQuery.error, quoteQuery.isError])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalQuantity,
      coupon,
      quote: quoteQuery.data ?? null,
      isLoading: cartQuery.isLoading,
      isQuoteLoading: quoteQuery.isLoading || quoteQuery.isFetching,
      quoteError,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      refetchQuote,
      isMutating,
      mutationError,
    }),
    [
      items,
      totalItems,
      totalQuantity,
      coupon,
      quoteQuery.data,
      cartQuery.isLoading,
      quoteQuery.isLoading,
      quoteQuery.isFetching,
      quoteError,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      refetchQuote,
      isMutating,
      mutationError,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve ser utilizado dentro de um CartProvider.')
  }
  return context
}
