import React from 'react'
import ReactDOM from 'react-dom/client'
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

  const [{ QueryClientProvider }, { RouterProvider }, { queryClient }, { router }] = await Promise.all([
    import('@tanstack/react-query'),
    import('@tanstack/react-router'),
    import('@/lib/query-client'),
    import('@/lib/router'),
  ])

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ mocks }} />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
