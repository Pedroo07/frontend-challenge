import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: () => {
    throw redirect({ to: '/checkout' })
  },
})
