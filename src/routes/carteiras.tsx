import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/carteiras')({
  beforeLoad: () => {
    throw redirect({
      to: '/perfil',
      search: { tab: 'carteiras' },
    })
  },
})
