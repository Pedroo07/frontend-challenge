import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from './checkout'

export const Route = createFileRoute('/pagamento')({
  component: CheckoutPage,
})
