import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { useAuth } from '@/lib/auth-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { formatEthDisplay } from '@/lib/eth-currency'
import { fetchOrder } from '@/lib/order-api'
import { useSocket } from '@/lib/socket-context'
import type { Order } from '@/mocks/contracts'

export const Route = createFileRoute('/pedidos/$orderId')({
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  const { orderId } = Route.useParams()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { isConnected, socketStatus } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search
      void navigate({ to: '/login', search: { redirect: currentPath } })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

  const orderQuery = useQuery<Order>({
    queryKey: ['orders', orderId],
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
    enabled: isAuthenticated,
    staleTime: 5000,
  })

  const order = orderQuery.data

  return (
    <div className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-7 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-5">
          <div>
            <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/" search={catalogSearchDefaults} className="hover:text-foreground">Início</Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-foreground" aria-current="page">Confirmação de Pedido</span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Confirmação de Pedido</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Recibo imutável e detalhes da transação simulada registrada no servidor.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span className={`size-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              Socket.IO: {isConnected ? 'Ativo' : socketStatus}
            </span>
          </div>
        </div>

        {orderQuery.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-xs font-semibold text-muted-foreground">Carregando recibo do pedido...</p>
          </div>
        ) : orderQuery.isError || !order ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center" role="alert">
            <h2 className="text-lg font-bold text-destructive">Pedido não encontrado</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Não foi possível localizar o identificador "{orderId}" junto ao servidor simulado.
            </p>
            <Link
              to="/"
              search={catalogSearchDefaults}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary-light"
            >
              Voltar ao catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Card */}
            {order.status === 'confirmed' ? (
              <div
                data-testid="order-confirmed-banner"
                className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 sm:p-8 text-center shadow-sm"
              >
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-emerald-400 sm:text-2xl">
                  Compra Confirmada com Sucesso!
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Seu pagamento simulado foi registrado e a posse dos NFTs foi confirmada na simulação.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                  Status: Confirmado
                </div>
              </div>
            ) : order.status === 'declined' ? (
              <div
                data-testid="order-declined-banner"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 sm:p-8 text-center shadow-sm"
                role="alert"
              >
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/20 text-destructive">
                  <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-destructive sm:text-2xl">
                  Pagamento Recusado
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {order.declineReason || 'A transação simulada foi recusada pela carteira do comprador.'}
                </p>
                <div className="mt-4">
                  <Link
                    to="/checkout"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-destructive px-5 text-xs font-semibold text-destructive-foreground hover:opacity-90"
                  >
                    Tentar novamente no checkout
                  </Link>
                </div>
              </div>
            ) : (
              <div
                data-testid="order-pending-banner"
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 sm:p-8 text-center shadow-sm"
                role="status"
              >
                <div className="mx-auto size-12 animate-spin rounded-full border-3 border-amber-400 border-t-transparent" />
                <h2 className="mt-4 text-xl font-extrabold text-amber-400 sm:text-2xl">
                  Aguardando Confirmação do Pagamento...
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  O pedido foi registrado e está aguardando validação pela rede simulada.
                </p>
                <button
                  type="button"
                  onClick={() => void orderQuery.refetch()}
                  className="mt-4 inline-flex items-center rounded-lg border border-amber-400 bg-amber-400/20 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/30"
                >
                  Consultar status agora
                </button>
              </div>
            )}

            {/* Receipt Details Card (Immutable snapshot) */}
            <article
              aria-label="Recibo do pedido"
              className="rounded-2xl border border-border bg-card p-5 sm:p-8 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Identificador do Pedido
                  </span>
                  <p data-testid="order-id" className="font-mono text-sm font-bold text-foreground">
                    {order.id}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Data da Compra
                  </span>
                  <p className="font-mono text-xs text-foreground">
                    {new Date(order.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Transaction Hash */}
              {order.transactionHash && (
                <div className="border-b border-border-soft py-4 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Hash da Transação Simulada
                  </span>
                  <p
                    data-testid="transaction-hash"
                    className="mt-0.5 break-all font-mono text-xs font-semibold text-primary"
                  >
                    {order.transactionHash}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Transação simulada para fins de demonstração (não transmitida a nenhuma blockchain pública real).
                  </p>
                </div>
              )}

              {/* Buyer & Wallet Info */}
              <div className="grid gap-4 border-b border-border-soft py-4 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Colecionador
                  </span>
                  <p data-testid="order-buyer-name" className="mt-0.5 font-semibold text-foreground">
                    {order.buyer.name}
                  </p>
                  <p data-testid="order-buyer-email" className="text-muted-foreground">
                    {order.buyer.email}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Carteira e Rede
                  </span>
                  <p data-testid="order-wallet-address" className="mt-0.5 font-mono font-semibold text-foreground">
                    {order.buyer.walletAddress}
                  </p>
                  <p data-testid="order-network" className="text-muted-foreground capitalize">
                    {order.buyer.network}
                  </p>
                </div>
              </div>

              {/* Purchased Items List */}
              <div className="py-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens adquiridos ({order.items.reduce((s, i) => s + i.quantity, 0)})
                </h3>

                <ul className="mt-3 divide-y divide-border-soft" role="list">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      data-testid={`receipt-item-${item.nftId}`}
                      className="flex items-center justify-between gap-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-12 shrink-0 rounded-xl object-cover bg-surface-raised"
                        />
                        <div>
                          <p data-testid={`receipt-item-name-${item.nftId}`} className="text-xs font-bold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.collectionName} · Edição {item.editionName} ({item.editionNumber})
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Qtd: {item.quantity} × {formatEthDisplay(item.unitPriceEth)} ETH
                          </p>
                        </div>
                      </div>

                      <span
                        data-testid={`receipt-item-subtotal-${item.nftId}`}
                        className="font-mono text-xs font-bold text-foreground"
                      >
                        {formatEthDisplay(item.subtotalEth)} ETH
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Financial Snapshot Summary */}
              <div className="border-t border-border-soft pt-4 text-xs space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span data-testid="receipt-subtotal" className="font-mono font-medium text-foreground">
                    {formatEthDisplay(order.subtotalEth)} ETH
                  </span>
                </div>

                {order.coupon && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Desconto ({order.coupon.code} - {order.coupon.discountPercent}%)</span>
                    <span data-testid="receipt-discount" className="font-mono font-medium">
                      -{formatEthDisplay(order.discountEth)} ETH
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa de rede simulada</span>
                  <span data-testid="receipt-fee" className="font-mono font-medium text-foreground">
                    {formatEthDisplay(order.networkFeeEth)} ETH
                  </span>
                </div>

                <div className="border-t border-border-soft pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-foreground">Total Pago</span>
                    <span
                      data-testid="receipt-total"
                      className="font-mono text-xl font-extrabold text-primary"
                    >
                      {formatEth(order.totalEth)} ETH
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* Next actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Link
                to="/"
                search={catalogSearchDefaults}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-xs font-semibold text-primary-foreground hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary"
              >
                Continuar explorando o catálogo
              </Link>

              <Link
                to="/carrinho"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                Ver carrinho
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
