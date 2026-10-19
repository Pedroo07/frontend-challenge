import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '@/lib/auth-context'
import { CartProvider } from '@/lib/cart-context'
import { SocketProvider } from '@/lib/socket-context'
import type { MockStatus } from '@/mocks/browser'

type RouterContext = { mocks: MockStatus }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <Outlet />
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
