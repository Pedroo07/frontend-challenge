import axios from 'axios'

export const AUTH_TOKEN_KEY = 'nft_auth_token'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 8_000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      const message = error.response?.data?.message
      if (message === 'Sessão expirada.') {
        window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { message } }))
      }
    }
    return Promise.reject(error)
  },
)
