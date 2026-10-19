import { createFileRoute, Link } from '@tanstack/react-router'
import axios from 'axios'
import React, { useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { formatEthDisplay } from '@/lib/eth-currency'
import { useSocket } from '@/lib/socket-context'
import type { CartItem } from '@/mocks/contracts'

export const Route = createFileRoute('/carrinho')({ component: CartPage })

function CartPage() {
  const {
    items,
    totalQuantity,
    coupon,
    quote,
    isLoading,
    isQuoteLoading,
    quoteError,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    refetchQuote,
    isMutating,
  } = useCart()

  const { isConnected, socketStatus, lastUpdate, triggerDemoUpdate } = useSocket()
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [checkoutNotice, setCheckoutNotice] = useState(false)

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponCode.trim()) return
    setCouponError(null)
    setIsApplyingCoupon(true)
    try {
      await applyCoupon(couponCode)
      setCouponCode('')
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setCouponError(String(err.response.data.message))
      } else if (err instanceof Error) {
        setCouponError(err.message)
      } else {
        setCouponError('Não foi possível aplicar o cupom.')
      }
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = async () => {
    setCouponError(null)
    try {
      await removeCoupon()
    } catch {
      // Ignored
    }
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-9 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-5">
          <div>
            <Link
              to="/"
              search={catalogSearchDefaults}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true">←</span> Voltar ao catálogo
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Carrinho de NFTs
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Revise suas seleções, quantidades e cotações em ETH em tempo real.
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
              <span
                className={`size-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
              />
              Socket.IO: {isConnected ? 'Ativo' : socketStatus}
            </span>

            <button
              type="button"
              onClick={() => setDemoOpen((open) => !open)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              {demoOpen ? 'Ocultar Demo' : 'Simular Tempo Real'}
            </button>
          </div>
        </div>

        {demoOpen && (
          <section
            aria-label="Controles de demonstração em tempo real"
            className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-primary">
                  Cenário de Demonstração (Socket.IO · nft.updated)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Altere deterministamente o preço ou o estoque de um NFT para verificar a revalidação imediata do carrinho.
                </p>
              </div>
              {lastUpdate && (
                <div className="text-right text-xs">
                  <span className="text-muted-foreground">Último evento recebido: </span>
                  <span className="font-semibold text-foreground">
                    {lastUpdate.nftId} · {lastUpdate.priceEth} ETH · {lastUpdate.available} disp (v{lastUpdate.version})
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() =>
                  void triggerDemoUpdate({
                    nftId: 'nft-aurora-017',
                    priceEth: '1.850',
                    available: 4,
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:bg-surface-raised"
              >
                Aumentar Preço de Aurora #017 (1.85 ETH)
              </button>

              <button
                type="button"
                onClick={() =>
                  void triggerDemoUpdate({
                    nftId: 'nft-aurora-017',
                    priceEth: '0.950',
                    available: 4,
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:bg-surface-raised"
              >
                Reduzir Preço de Aurora #017 (0.95 ETH)
              </button>

              <button
                type="button"
                onClick={() =>
                  void triggerDemoUpdate({
                    nftId: 'nft-aurora-017',
                    priceEth: '1.275',
                    available: 1,
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:bg-surface-raised"
              >
                Reduzir Estoque de Aurora #017 (1 unid.)
              </button>

              <button
                type="button"
                onClick={() =>
                  void triggerDemoUpdate({
                    nftId: 'nft-aurora-017',
                    priceEth: '1.275',
                    available: 0,
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-destructive hover:text-destructive"
              >
                Esgotar Aurora #017 (0 unid.)
              </button>

              <button
                type="button"
                onClick={() =>
                  void triggerDemoUpdate({
                    nftId: 'nft-aurora-017',
                    priceEth: '1.275',
                    available: 4,
                  })
                }
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Restaurar Aurora #017 (Padrão)
              </button>
            </div>
          </section>
        )}

        {isLoading ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <EmptyCartView />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            <section aria-labelledby="cart-items-heading" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="cart-items-heading" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Itens no carrinho ({totalQuantity})
                </h2>
                <button
                  type="button"
                  onClick={() => void clearCart()}
                  disabled={isMutating}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  Limpar carrinho
                </button>
              </div>

              {quote?.conflicts && quote.conflicts.length > 0 && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-medium text-amber-200"
                >
                  <p className="font-bold text-amber-400">Alterações recentes no seu pedido:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {quote.conflicts.map((conflict, i) => (
                      <li key={i}>{conflict.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="space-y-3" role="list">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isMutating={isMutating}
                    onUpdateQuantity={(qty) => void updateQuantity(item.id, qty)}
                    onRemove={() => void removeItem(item.id)}
                  />
                ))}
              </ul>
            </section>

            <aside aria-labelledby="order-summary-heading">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6 lg:sticky lg:top-6">
                <h2 id="order-summary-heading" className="text-base font-bold text-foreground">
                  Resumo do pedido
                </h2>

                <form onSubmit={handleApplyCoupon} className="mt-4 border-b border-border-soft pb-5">
                  <label htmlFor="cart-coupon-input" className="block text-xs font-semibold text-muted-foreground">
                    Cupom de desconto
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="cart-coupon-input"
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Ex: PROMO10"
                      disabled={isApplyingCoupon || Boolean(coupon)}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-3 text-xs uppercase text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponCode.trim() || Boolean(coupon)}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isApplyingCoupon ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>

                  {couponError && (
                    <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                      {couponError}
                    </p>
                  )}

                  {coupon && (
                    <div className="mt-2.5 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
                      <span>
                        Cupom <strong>{coupon.code}</strong> ({coupon.discountPercent}% OFF)
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveCoupon()}
                        className="text-[11px] underline hover:text-emerald-200"
                      >
                        Remover
                      </button>
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-muted-foreground/70">
                    Cupons disponíveis para teste: <code>PROMO10</code> (10%), <code>CRYPTO20</code> (20%), <code>KURIO5</code> (5%), <code>EXPIRED50</code> (expirado).
                  </div>
                </form>

                {quoteError ? (
                  <div role="alert" className="my-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <p className="font-semibold">{quoteError}</p>
                    <button
                      type="button"
                      onClick={() => void refetchQuote()}
                      className="mt-2 inline-flex items-center rounded bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : (
                  <div className="my-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {quote ? formatEth(quote.subtotalEth) : formatEthDisplay('0')} ETH
                      </span>
                    </div>

                    {quote && quote.discountEth !== '0' && (
                      <div className="flex items-center justify-between text-emerald-400">
                        <span>Desconto ({quote.coupon?.discountPercent}%)</span>
                        <span className="font-semibold tabular-nums">
                          −{formatEth(quote.discountEth)} ETH
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Taxa de rede estimada</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {quote ? formatEth(quote.networkFeeEth) : '0.0025'} ETH
                      </span>
                    </div>

                    <div className="border-t border-border-soft pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-foreground">Total</span>
                        <div className="text-right">
                          <span
                            data-testid="quote-total"
                            className="text-xl font-extrabold tracking-tight text-primary tabular-nums sm:text-2xl"
                          >
                            {quote ? formatEth(quote.totalEth) : '0.00'} ETH
                          </span>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {isQuoteLoading ? 'Atualizando cotação...' : 'Cotação oficial garantida'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    items.length === 0 ||
                    isMutating ||
                    Boolean(quoteError) ||
                    (quote !== null && !quote.isValid)
                  }
                  onClick={() => setCheckoutNotice(true)}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quote && !quote.isValid ? 'Ajuste os itens para continuar' : 'Avançar para o pagamento'}
                </button>

                {checkoutNotice && (
                  <div
                    role="status"
                    className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-2.5 text-center text-xs text-primary"
                  >
                    O fluxo de carteiras e pagamento será integrado na <strong>Etapa 5</strong>!
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function CartItemRow({
  item,
  isMutating,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem
  isMutating: boolean
  onUpdateQuantity: (qty: number) => void
  onRemove: () => void
}) {
  const isSoldOut = item.available <= 0
  const isOverStock = item.quantity > item.available

  return (
    <li
      data-testid={`cart-item-${item.nftId}`}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-raised sm:size-24">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {item.collectionName}
            </span>
            {item.priceChanged && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                Preço alterado
              </span>
            )}
            {isSoldOut ? (
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                Esgotado
              </span>
            ) : isOverStock ? (
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                Apenas {item.available} disp.
              </span>
            ) : null}
          </div>

          <h3 className="truncate text-sm font-bold text-foreground sm:text-base">
            <Link
              to="/nfts/$nftId"
              params={{ nftId: item.nftId }}
              className="hover:underline focus-visible:outline-1 focus-visible:outline-primary"
            >
              {item.name}
            </Link>
          </h3>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.editionName} · Edição #{item.editionNumber}
          </p>

          <p className="mt-1 text-xs font-semibold text-foreground">
            {formatEth(item.unitPriceEth)} ETH <span className="font-normal text-muted-foreground">/ unidade</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border-soft pt-3 sm:border-t-0 sm:pt-0">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised p-1">
          <button
            type="button"
            disabled={item.quantity <= 1 || isMutating}
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            aria-label={`Diminuir quantidade de ${item.name}`}
            className="grid size-8 place-items-center rounded text-sm text-foreground transition hover:bg-border/60 disabled:opacity-40"
          >
            −
          </button>

          <span
            data-testid={`item-qty-${item.nftId}`}
            aria-label={`Quantidade: ${item.quantity}`}
            className="w-8 text-center text-xs font-bold tabular-nums text-foreground"
          >
            {item.quantity}
          </span>

          <button
            type="button"
            disabled={item.quantity >= item.available || isMutating}
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
            className="grid size-8 place-items-center rounded text-sm text-foreground transition hover:bg-border/60 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="text-right">
          <p
            data-testid={`item-subtotal-${item.nftId}`}
            className="text-sm font-bold tabular-nums text-primary sm:text-base"
          >
            {formatEth(item.subtotalEth)} ETH
          </p>
          <button
            type="button"
            onClick={onRemove}
            disabled={isMutating}
            aria-label={`Remover ${item.name} do carrinho`}
            className="mt-1 text-[11px] font-medium text-muted-foreground transition hover:text-destructive focus-visible:outline-1 focus-visible:outline-primary"
          >
            Remover
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyCartView() {
  return (
    <section aria-labelledby="empty-cart-heading" className="mx-auto max-w-lg py-16 text-center">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-xl sm:p-12">
        <div aria-hidden="true" className="mx-auto grid size-16 place-items-center rounded-full bg-surface-raised text-3xl text-primary">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-8">
            <path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="20" r="1.3" fill="currentColor" />
            <circle cx="18" cy="20" r="1.3" fill="currentColor" />
          </svg>
        </div>
        <h2 id="empty-cart-heading" className="mt-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Seu carrinho está vazio
        </h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
          Explore o catálogo e adicione edições de obras exclusivas à sua coleção digital.
        </p>
        <Link
          to="/"
          search={catalogSearchDefaults}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary"
        >
          Explorar catálogo
        </Link>
      </div>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div role="status" aria-label="Carregando carrinho" className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="h-4 w-40 animate-shimmer rounded bg-surface-raised" />
        <div className="h-28 w-full animate-shimmer rounded-2xl bg-surface-raised" />
        <div className="h-28 w-full animate-shimmer rounded-2xl bg-surface-raised" />
      </div>
      <div className="h-80 animate-shimmer rounded-2xl bg-surface-raised" />
    </div>
  )
}
