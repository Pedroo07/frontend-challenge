import { createRouter } from '@tanstack/react-router'
import type { MockStatus } from '@/mocks/browser'
import { routeTree } from '../routeTree.gen'

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  context: { mocks: 'starting' as MockStatus },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
