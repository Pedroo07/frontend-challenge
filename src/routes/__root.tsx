import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '@/lib/auth-context'
import type { MockStatus } from '@/mocks/browser'

type RouterContext = { mocks: MockStatus }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
