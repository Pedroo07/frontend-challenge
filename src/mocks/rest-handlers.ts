import { http, HttpResponse } from 'msw'
import type { HealthResponse } from './contracts'

export const restHandlers = [
  http.get('/api/health', () => {
    const response: HealthResponse = {
      status: 'ok',
      service: 'nft-marketplace-mock-api',
      checkedAt: new Date().toISOString(),
    }

    return HttpResponse.json(response)
  }),
]
