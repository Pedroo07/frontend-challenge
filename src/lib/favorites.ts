import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { useAuth } from './auth-context'
import { http } from './http'
import { router } from './router'
import type { FavoriteMutationResponse, FavoritesResponse } from '@/mocks/contracts'

export function useFavorites() {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)

  const queryKey = useMemo(() => ['favorites', user?.id], [user?.id])

  const favoritesQuery = useQuery<string[]>({
    queryKey,
    queryFn: async () => {
      const response = await http.get<FavoritesResponse>('/api/favorites')
      return response.data.items
    },
    enabled: Boolean(isAuthenticated && user?.id),
    staleTime: 30_000,
  })

  const favoriteIds = isAuthenticated ? (favoritesQuery.data ?? []) : []

  const toggleMutation = useMutation({
    mutationFn: async ({ nftId, action }: { nftId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        const response = await http.post<FavoriteMutationResponse>('/api/favorites', { nftId })
        return response.data
      }
      const response = await http.delete<FavoriteMutationResponse>(`/api/favorites/${nftId}`)
      return response.data
    },
    onMutate: async ({ nftId, action }) => {
      setMutationError(null)
      await queryClient.cancelQueries({ queryKey })

      const previousFavorites = queryClient.getQueryData<string[]>(queryKey) ?? []

      const nextFavorites = action === 'add'
        ? [...previousFavorites.filter((id) => id !== nftId), nftId]
        : previousFavorites.filter((id) => id !== nftId)

      queryClient.setQueryData(queryKey, nextFavorites)

      return { previousFavorites }
    },
    onError: (err, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKey, context.previousFavorites)
      }
      const message = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : 'Não foi possível atualizar os favoritos.'
      setMutationError(message)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const isFavorite = (nftId: string) => favoriteIds.includes(nftId)

  const toggleFavorite = async (nft: { id: string; name?: string }) => {
    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search
      void router.navigate({ to: '/login', search: { redirect: currentPath } })
      return
    }

    if (toggleMutation.isPending && toggleMutation.variables?.nftId === nft.id) {
      return
    }

    const action = isFavorite(nft.id) ? 'remove' : 'add'
    try {
      await toggleMutation.mutateAsync({ nftId: nft.id, action })
    } catch  {
      void 0
    }
  }

  return {
    favoriteIds,
    isLoading: favoritesQuery.isLoading,
    isFavorite,
    toggleFavorite,
    isPending: toggleMutation.isPending,
    pendingNftId: toggleMutation.variables?.nftId,
    error: mutationError,
    clearError: () => setMutationError(null),
  }
}
