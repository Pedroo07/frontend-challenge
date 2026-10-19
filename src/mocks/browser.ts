import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

const mocksEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true'
const worker = setupWorker(...handlers)

export type MockStatus = 'enabled' | 'disabled' | 'starting' | 'ready' | 'error'

export async function startBrowserMocks(): Promise<MockStatus> {
  if (!mocksEnabled) return 'disabled'

  try {
    await worker.start({
      onUnhandledRequest(request, print) {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/api/')) print.error()
      },
    })
    return 'ready'
  } catch (error) {
    console.error('Não foi possível inicializar o MSW no navegador.', error)
    return 'error'
  }
}
