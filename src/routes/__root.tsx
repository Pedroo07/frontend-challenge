import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { MockStatus } from '@/mocks/browser'

type RouterContext = { mocks: MockStatus }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
})
