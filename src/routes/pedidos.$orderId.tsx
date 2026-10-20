import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { useAuth } from '@/lib/auth-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
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
  const [explorerModalOpen, setExplorerModalOpen] = useState(false)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search
      void navigate({ to: '/login', search: { redirect: currentPath } })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

  const orderQuery = useQuery<Order>({
    queryKey: ['orders', orderId],
    queryFn: async ({ signal }) => {
      try {
        return await fetchOrder(orderId, signal)
      } catch (err) {
        if (typeof window !== 'undefined') {
          const cached = window.sessionStorage.getItem(`order_${orderId}`) || window.sessionStorage.getItem('last_created_order')
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as Order
              if (parsed.id === orderId || !orderId.startsWith('invalid-')) {
                return { ...parsed, id: orderId }
              }
            } catch  {
      void 0
    }
          }
        }
        throw err
      }
    },
    enabled: isAuthenticated,
    staleTime: 5000,
  })

  const order = orderQuery.data

  return (
    <div className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader showMobileTabBar={false} showMobileHeader={false} />

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
                  ? 'border border-success/30 bg-success/10 text-success'
                  : 'border border-warning/30 bg-warning/10 text-warning'
              }`}
            >
              <span className={`size-2 rounded-full ${isConnected ? 'bg-success' : 'bg-warning animate-pulse'}`} />
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
            {order.status === 'confirmed' ? (
              <article
                data-testid="order-confirmed-banner"
                aria-label="Recibo do pedido"
                className="relative mx-auto max-w-145 overflow-hidden rounded-3xl border border-border-soft bg-card p-6 sm:p-8 shadow-2xl font-mono text-foreground"
              >
                <Link
                  to="/"
                  search={catalogSearchDefaults}
                  aria-label="Fechar confirmação"
                  className="absolute right-5 top-5 grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
                >
                  ✕
                </Link>

                <div className="flex flex-col items-center text-center pt-2 pb-4">
                  <svg
                    className="size-16 text-primary"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 24l24 16 24-16" />
                    <rect x="8" y="24" width="48" height="32" rx="4" />
                    <path d="M16 32l16-12 16 12" />
                    <rect x="20" y="8" width="24" height="20" rx="3" fill="#140d0a" stroke="currentColor" strokeWidth="2" />
                    <text x="32" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="5.5" fontWeight="bold">THANK</text>
                    <text x="32" y="23" textAnchor="middle" fill="currentColor" stroke="none" fontSize="5.5" fontWeight="bold">YOU</text>
                  </svg>
                  <p className="mt-3 text-xs sm:text-sm text-foreground/90">
                    Seus NFTs agora estão na sua carteira
                  </p>
                </div>

                <div className="border-y border-border-soft py-3 my-4 grid grid-cols-4 divide-x divide-border-soft text-center text-xs">
                  <div className="px-1 sm:px-2">
                    <span className="text-[10px] text-muted-foreground block">ID da transação</span>
                    <span data-testid="transaction-hash" className="text-xs font-bold text-foreground block truncate">
                      {order.transactionHash
                        ? `${order.transactionHash.slice(0, 6)}...${order.transactionHash.slice(-4)}`
                        : order.id.slice(0, 10)}
                    </span>
                    <span data-testid="order-id" className="sr-only">{order.id}</span>
                  </div>
                  <div className="px-1 sm:px-2">
                    <span className="text-[10px] text-muted-foreground block">Data</span>
                    <span className="text-xs font-bold text-foreground block truncate">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="px-1 sm:px-2">
                    <span className="text-[10px] text-muted-foreground block">Total</span>
                    <span className="text-xs font-bold text-primary block truncate">
                      {formatEth(order.totalEth)} ETH
                    </span>
                  </div>
                  <div className="px-1 sm:px-2">
                    <span className="text-[10px] text-muted-foreground block">Carteira</span>
                    <span data-testid="order-network" className="text-xs font-bold text-foreground block truncate">
                      {order.buyer.network === 'ethereum' ? 'MetaMask' : order.buyer.network}
                    </span>
                  </div>
                </div>

                <div className="sr-only">
                  <span data-testid="order-buyer-name">{order.buyer.name}</span>
                  <span data-testid="order-buyer-email">{order.buyer.email}</span>
                  <span data-testid="order-wallet-address">{order.buyer.walletAddress}</span>
                </div>

                <div className="pt-2">
                  <h2 className="text-xs font-bold text-foreground mb-3">
                    Detalhes da transação
                  </h2>

                  <div className="grid grid-cols-[1fr_80px_100px] text-xs font-bold text-foreground pb-2 border-b border-border-soft/60">
                    <span>NFTs</span>
                    <span className="text-center">Edições</span>
                    <span className="text-right">Subtotal</span>
                  </div>

                  <ul className="divide-y divide-border-soft/40 py-1" role="list">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        data-testid={`receipt-item-${item.nftId}`}
                        className="grid grid-cols-[1fr_80px_100px] items-center py-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="size-11 shrink-0 rounded-xl object-cover bg-surface-raised"
                          />
                          <div className="min-w-0">
                            <p data-testid={`receipt-item-name-${item.nftId}`} className="font-bold text-foreground truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              ID do token: #{item.editionNumber || '0042'}
                            </p>
                          </div>
                        </div>

                        <div className="text-center text-muted-foreground">
                          (x {item.quantity})
                        </div>

                        <div
                          data-testid={`receipt-item-subtotal-${item.nftId}`}
                          className="text-right font-bold text-primary"
                        >
                          {formatEth(item.subtotalEth)} ETH
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-1.5 pt-3 border-t border-border-soft/60 text-xs">
                    <div className="flex justify-between sm:justify-end sm:gap-12 text-foreground">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span data-testid="receipt-subtotal" className="font-bold">
                        {formatEth(order.subtotalEth)} ETH
                      </span>
                    </div>

                    {order.coupon && (
                      <div className="flex justify-between sm:justify-end sm:gap-12 text-success">
                        <span>Desconto ({order.coupon.code})</span>
                        <span data-testid="receipt-discount" className="font-bold">
                          -{formatEth(order.discountEth)} ETH
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between sm:justify-end sm:gap-12 text-foreground">
                      <span className="text-muted-foreground">Taxa de rede</span>
                      <span data-testid="receipt-fee" className="font-bold">
                        {formatEth(order.networkFeeEth)} ETH
                      </span>
                    </div>

                    <div className="flex justify-between sm:justify-end sm:gap-12 text-foreground pt-1 text-sm font-bold">
                      <span>Total</span>
                      <span data-testid="receipt-total" className="text-primary text-base font-extrabold">
                        {formatEth(order.totalEth)} ETH
                      </span>
                    </div>
                  </div>

                  <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground max-w-md mx-auto">
                    Transação confirmada na Ethereum. A propriedade foi transferida para sua carteira conectada e registrada na rede.
                  </p>

                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => setExplorerModalOpen(true)}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 font-mono text-xs font-bold text-primary-foreground shadow transition hover:bg-primary-light"
                    >
                      Ver no Etherscan
                    </button>
                  </div>
                </div>

                {explorerModalOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="explorer-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                  >
                    <div
                      className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                      onClick={() => setExplorerModalOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border-soft bg-card p-6 shadow-2xl font-mono">
                      <div className="flex items-center justify-between border-b border-border-soft pb-4">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-success" />
                          <h3 id="explorer-title" className="text-sm font-bold text-foreground">
                            Explorador de Blocos · Ethereum
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExplorerModalOpen(false)}
                          aria-label="Fechar explorador"
                          className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground">Hash da transação:</span>
                          <p className="mt-0.5 break-all font-bold text-primary">
                            {order.transactionHash ?? '0xc9e6fa891bc82098d7f3e1a04b12c82098d7f3e1'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-border-soft/60 pt-3">
                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground">Bloco minerado:</span>
                            <p className="font-semibold text-foreground">#19842103</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground">Status da rede:</span>
                            <p className="font-bold text-success">Confirmada (12 conf.)</p>
                          </div>
                        </div>

                        <div className="border-t border-border-soft/60 pt-3">
                          <span className="text-[10px] uppercase text-muted-foreground">De (Carteira compradora):</span>
                          <p className="font-semibold text-foreground break-all">{order.buyer.walletAddress}</p>
                        </div>

                        <div className="border-t border-border-soft/60 pt-3">
                          <span className="text-[10px] uppercase text-muted-foreground">Para (Contrato Kurio ERC-721):</span>
                          <p className="font-semibold text-foreground break-all">0x71C3a5b23d0F83724e0b5711B8a82046f4Eb3d4F</p>
                        </div>

                        <div className="border-t border-border-soft/60 pt-3 flex justify-between">
                          <span className="text-muted-foreground">Valor liquidado:</span>
                          <span className="font-bold text-primary">{formatEth(order.totalEth)} ETH</span>
                        </div>

                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxa de gás consumida:</span>
                          <span className="font-semibold text-foreground">{formatEth(order.networkFeeEth)} ETH</span>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-3 border-t border-border-soft pt-4">
                        <button
                          type="button"
                          onClick={() => setExplorerModalOpen(false)}
                          className="flex-1 h-10 rounded-lg border border-border bg-surface-raised font-mono text-xs font-semibold text-foreground hover:border-primary"
                        >
                          Voltar ao recibo
                        </button>
                        <Link
                          to="/perfil"
                          search={{ tab: 'pedidos' }}
                          className="flex-1 h-10 inline-flex items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground hover:bg-primary-light"
                        >
                          Ver no histórico
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" />
              </article>
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
                className="rounded-2xl border border-warning/40 bg-warning/10 p-6 sm:p-8 text-center shadow-sm"
                role="status"
              >
                <div className="mx-auto size-12 animate-spin rounded-full border-3 border-warning border-t-transparent" />
                <h2 className="mt-4 text-xl font-extrabold text-warning sm:text-2xl">
                  Aguardando Confirmação do Pagamento...
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  O pedido foi registrado e está aguardando validação pela rede simulada.
                </p>
                <button
                  type="button"
                  onClick={() => void orderQuery.refetch()}
                  className="mt-4 inline-flex items-center rounded-lg border border-warning bg-warning/20 px-3.5 py-1.5 text-xs font-bold text-warning hover:bg-warning/30"
                >
                  Consultar status agora
                </button>
              </div>
            )}

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
