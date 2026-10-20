import { http } from './http'
import type { CreateOrderPayload, Order, OrderStatus, OrderUpdatedEvent } from '@/mocks/contracts'

export async function createOrder(payload: CreateOrderPayload, signal?: AbortSignal): Promise<Order> {
  const response = await http.post<Order>('/api/orders', payload, {
    signal,
    headers: {
      'Idempotency-Key': payload.idempotencyKey,
    },
  })
  return response.data
}

export async function fetchOrder(orderId: string, signal?: AbortSignal): Promise<Order> {
  const response = await http.get<Order>(`/api/orders/${orderId}`, { signal })
  return response.data
}

export async function simulateOrderPayment(
  orderId: string,
  action?: 'confirm' | 'decline' | 'pending',
  signal?: AbortSignal,
): Promise<Order> {
  const response = await http.post<Order>(`/api/orders/${orderId}/pay`, { action }, { signal })
  return response.data
}

export async function triggerMockOrderUpdate(event: OrderUpdatedEvent): Promise<void> {
  await http.post('/api/_mock/scenarios/emit-order-update', event)
}

export async function setPaymentResultScenario(result: OrderStatus | null): Promise<void> {
  await http.post('/api/_mock/scenarios/order-payment-result', { result })
}

export async function setTimeoutAfterOrderCreateScenario(enabled = true): Promise<void> {
  await http.post('/api/_mock/scenarios/order-timeout-after-create', { enabled })
}
