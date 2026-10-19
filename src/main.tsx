import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { queryClient } from '@/lib/query-client'
import { router } from '@/lib/router'
import type { MockStatus } from '@/mocks/browser'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento #root não encontrado.')
}

const root = ReactDOM.createRoot(rootElement)

async function bootstrap() {
  let mocks: MockStatus = 'disabled'

  if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startBrowserMocks } = await import('@/mocks/browser')
    mocks = await startBrowserMocks()
  }

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ mocks }} />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
