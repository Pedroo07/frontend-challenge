import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { AUTH_TOKEN_KEY, getOrCreateGuestId, http, resetGuestId } from './http'
import { router } from './router'
import type { AuthResponse, SessionResponse, User } from '@/mocks/contracts'

type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: { email: string; password?: string }) => Promise<void>
  register: (data: { name: string; email: string; password?: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery<User | null>({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      if (typeof window === 'undefined') return null
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
      if (!token) return null

      try {
        const response = await http.get<SessionResponse>('/api/auth/session')
        return response.data.user
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          window.localStorage.removeItem(AUTH_TOKEN_KEY)
          return null
        }
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    const handleExpired = () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
      }
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.removeQueries({ queryKey: ['account'] })
      queryClient.removeQueries({ queryKey: ['orders'] })
      queryClient.removeQueries({ queryKey: ['wallets'] })
      queryClient.removeQueries({ queryKey: ['cart'] })
      queryClient.removeQueries({ queryKey: ['cart', 'quote'] })
      queryClient.setQueryData(['auth', 'session'], null)
      resetGuestId()

      const currentPath = window.location.pathname + window.location.search
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/cadastro')) {
        void router.navigate({ to: '/login', search: { redirect: currentPath } })
      }
    }

    window.addEventListener('auth:session-expired', handleExpired)
    return () => window.removeEventListener('auth:session-expired', handleExpired)
  }, [queryClient])

  const login = useCallback(async (credentials: { email: string; password?: string }) => {
    const guestId = getOrCreateGuestId()
    const response = await http.post<AuthResponse>('/api/auth/login', credentials)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_TOKEN_KEY, response.data.token)
    }

    if (guestId) {
      try {
        await http.post('/api/cart/merge', { guestId })
        resetGuestId()
      } catch  {
      void 0
    }
    }

    queryClient.removeQueries({ queryKey: ['favorites'] })
    queryClient.removeQueries({ queryKey: ['account'] })
    queryClient.removeQueries({ queryKey: ['orders'] })
    queryClient.removeQueries({ queryKey: ['wallets'] })
    queryClient.removeQueries({ queryKey: ['cart'] })
    queryClient.removeQueries({ queryKey: ['cart', 'quote'] })
    queryClient.setQueryData(['auth', 'session'], response.data.user)
  }, [queryClient])

  const register = useCallback(async (data: { name: string; email: string; password?: string }) => {
    const guestId = getOrCreateGuestId()
    const response = await http.post<AuthResponse>('/api/auth/register', data)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_TOKEN_KEY, response.data.token)
    }

    if (guestId) {
      try {
        await http.post('/api/cart/merge', { guestId })
        resetGuestId()
      } catch  {
      void 0
    }
    }

    queryClient.removeQueries({ queryKey: ['favorites'] })
    queryClient.removeQueries({ queryKey: ['account'] })
    queryClient.removeQueries({ queryKey: ['orders'] })
    queryClient.removeQueries({ queryKey: ['wallets'] })
    queryClient.removeQueries({ queryKey: ['cart'] })
    queryClient.removeQueries({ queryKey: ['cart', 'quote'] })
    queryClient.setQueryData(['auth', 'session'], response.data.user)
  }, [queryClient])

  const logout = useCallback(async () => {
    try {
      await http.post('/api/auth/logout')
    } catch  {
      void 0
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
      }
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.removeQueries({ queryKey: ['account'] })
      queryClient.removeQueries({ queryKey: ['orders'] })
      queryClient.removeQueries({ queryKey: ['wallets'] })
      queryClient.removeQueries({ queryKey: ['cart'] })
      queryClient.removeQueries({ queryKey: ['cart', 'quote'] })
      queryClient.setQueryData(['auth', 'session'], null)
      resetGuestId()
    }
  }, [queryClient])

  const user = sessionQuery.data ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading: sessionQuery.isLoading,
      login,
      register,
      logout,
    }),
    [user, sessionQuery.isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.')
  }
  return context
}
