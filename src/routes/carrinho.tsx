import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import axios from 'axios'
import React, { useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { SiteFooter } from '@/components/site-footer'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { getNftList } from '@/lib/nft-api'
import { useSocket } from '@/lib/socket-context'
import type { CartItem, NftListItem } from '@/mocks/contracts'

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

  const { isConnected, socketStatus, lastUpdate, updatedNfts, triggerDemoUpdate } = useSocket()
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  // Obras recomendadas para a seção "Colecionadores também viram"
  const recommendationsQuery = useQuery({
    queryKey: ['nfts', 'recommendations'],
    queryFn: ({ signal }) =>
      getNftList(
        {
          q: '',
          collection: 'all',
          available: true,
          sort: 'newest',
          minPrice: 0,
          maxPrice: 10,
          network: 'all',
          page: 1,
        },
        signal,
      ),
    staleTime: 60_000,
  })

  const recommendedItems: NftListItem[] = (recommendationsQuery.data?.items ?? []).slice(0, 5)

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
      // Handled by context
    }
  }

  const hasSocketUpdatesInCart = items.some(
    (item) => updatedNfts[item.nftId] !== undefined || item.priceChanged,
  )

  return (
    <div className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader activeNav="mercado" />

      <main className="mx-auto w-full max-w-300 px-4 py-4 sm:px-6 sm:py-6 lg:px-0">
        {/* Mobile Header com botão voltar e título (Figma Mobile 390px) */}
        <div className="flex items-center gap-3 pb-5 md:hidden">
          <Link
            to="/"
            search={catalogSearchDefaults}
            aria-label="Voltar para o catálogo"
            className="grid size-10 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <BackIcon className="size-4" />
          </Link>
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
            Carrinho de NFTs
          </h1>
        </div>

        {/* Desktop Breadcrumb & Heading (Figma Desktop 1440px) */}
        <div className="hidden md:block pb-5">
          <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              to="/"
              search={catalogSearchDefaults}
              className="transition-colors hover:text-foreground"
            >
              Início
            </Link>
            <span aria-hidden="true" className="text-border-soft">/</span>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchDefaults}
              className="transition-colors hover:text-foreground"
            >
              Mercado
            </Link>
            <span aria-hidden="true" className="text-border-soft">/</span>
            <span className="text-foreground">Carrinho</span>
          </nav>

          <div className="mt-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Carrinho de NFTs
            </h1>

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
        </div>

        {/* Painel de Demonstração Interativa Socket.IO */}
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
                  Altere deterministamente o preço ou estoque de Aurora #017 para verificar a revalidação imediata do carrinho.
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
                Aumentar Preço (1.85 ETH)
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
                Reduzir Preço (0.95 ETH)
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
                Reduzir Estoque (1 unid.)
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
                Esgotar Estoque (0 unid.)
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
                Restaurar Padrão
              </button>
            </div>
          </section>
        )}

        {/* Banner de tempo real caso itens tenham sido alterados */}
        {hasSocketUpdatesInCart && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-medium text-amber-200"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-base">⚡</span>
              <span>
                <strong>Alteração em tempo real:</strong> O preço ou estoque de uma obra no carrinho foi modificado. Seus valores foram recalculados.
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <EmptyCartView />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] items-start">
            {/* Coluna Esquerda: Listagem de Itens (Tabela Desktop / Cards Mobile) */}
            <section aria-labelledby="cart-items-heading" className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h2 id="cart-items-heading" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens no carrinho ({totalQuantity})
                </h2>
                <button
                  type="button"
                  onClick={() => void clearCart()}
                  disabled={isMutating}
                  className="text-xs font-medium text-muted-foreground transition hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  Limpar carrinho
                </button>
              </div>

              {/* Alerta de conflitos do quote (ex: esgotado ou preço alterado) */}
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

              {/* Cabeçalho da Tabela (Visível em Desktop) */}
              <div
                aria-hidden="true"
                className="hidden md:grid md:grid-cols-[1fr_120px_140px_120px_44px] items-center gap-4 border-b border-border-soft pb-3 font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                <span>NFTs</span>
                <span>Preço</span>
                <span className="text-center">Edições</span>
                <span className="text-right">Total</span>
                <span className="sr-only">Ações</span>
              </div>

              {/* Lista dos Itens */}
              <ul className="space-y-3 md:space-y-0" role="list">
                {items.map((item) => (
                  <CartItemUnifiedRow
                    key={item.id}
                    item={item}
                    isMutating={isMutating}
                    onUpdateQuantity={(qty) => void updateQuantity(item.id, qty)}
                    onRemove={() => void removeItem(item.id)}
                  />
                ))}
              </ul>
            </section>

            {/* Coluna Direita: Resumo da Carteira (Figma) */}
            <aside aria-labelledby="order-summary-heading">
              <div className="rounded-2xl sm:rounded-3xl border border-border/40 bg-card p-5 sm:p-6 shadow-xl lg:sticky lg:top-6">
                <h2 id="order-summary-heading" className="font-mono text-base font-bold text-foreground">
                  Resumo da carteira
                </h2>

                {/* Formulário de Cupom de Desconto */}
                <form onSubmit={handleApplyCoupon} className="mt-4 border-b border-border-soft pb-5">
                  <label
                    htmlFor="cart-coupon-input"
                    className="block font-mono text-xs font-semibold text-muted-foreground"
                  >
                    Código promocional
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="cart-coupon-input"
                      aria-label="Cupom de desconto"
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Digite o código promocional..."
                      disabled={isApplyingCoupon || Boolean(coupon)}
                      className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 font-mono text-xs uppercase text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponCode.trim() || Boolean(coupon)}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm bg-primary px-4 font-mono text-xs font-bold text-primary-foreground transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isApplyingCoupon ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>

                  {couponError && (
                    <p role="alert" className="mt-2 font-mono text-xs font-medium text-destructive">
                      {couponError}
                    </p>
                  )}

                  {coupon && (
                    <div className="mt-2.5 flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400">
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

                  <div className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                    Cupons para teste: <code>PROMO10</code> (10%), <code>CRYPTO20</code> (20%), <code>KURIO5</code> (5%), <code>EXPIRED50</code> (expirado).
                  </div>
                </form>

                {/* Valores Financeiros */}
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
                  <div className="my-5 space-y-3 font-mono text-xs sm:text-sm">
                    {/* Subtotal */}
                    <div className="flex items-center justify-between text-foreground">
                      <span>Subtotal</span>
                      <span className="font-bold tabular-nums">
                        {quote ? formatEth(quote.subtotalEth) : '0.00'} ETH
                      </span>
                    </div>

                    {/* Desconto do Cupom */}
                    <div className="flex items-center justify-between text-foreground">
                      <span>Desconto do lançamento</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {quote && quote.discountEth !== '0'
                          ? `(-) ${formatEth(quote.discountEth)} ETH`
                          : '(-) 00.00'}
                      </span>
                    </div>

                    {/* Taxa de Rede */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-foreground">
                        <span>Taxa de rede</span>
                        <span className="font-bold tabular-nums">
                          {quote ? formatEth(quote.networkFeeEth) : '0.016'} ETH
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[10px] text-primary">Taxa estimada</span>
                      </div>
                    </div>

                    {/* Total Final */}
                    <div className="border-t border-border-soft pt-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-foreground sm:text-base">Total</span>
                        <div className="text-right">
                          <span
                            data-testid="quote-total"
                            className="text-lg font-extrabold tracking-tight text-primary tabular-nums sm:text-xl"
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

                {/* Botão de Finalização / Checkout */}
                {items.length === 0 || isMutating || Boolean(quoteError) || (quote !== null && !quote.isValid) ? (
                  <button
                    type="button"
                    disabled
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-sm bg-primary font-mono text-sm font-bold text-primary-foreground opacity-50 cursor-not-allowed"
                  >
                    {quote && !quote.isValid ? 'Ajuste os itens para continuar' : 'Avançar para o pagamento'}
                  </button>
                ) : (
                  <Link
                    to="/checkout"
                    aria-label="Avançar para o pagamento"
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-sm bg-primary font-mono text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Conectar e finalizar
                  </Link>
                )}

                {/* Link Continuar Explorando */}
                <div className="mt-3 text-center">
                  <Link
                    to="/"
                    search={catalogSearchDefaults}
                    className="font-mono text-xs text-primary transition hover:underline focus-visible:outline-1 focus-visible:outline-primary"
                  >
                    Continuar explorando
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Seção Colecionadores também viram (Figma Desktop) */}
        {recommendedItems.length > 0 && (
          <section aria-labelledby="recommendations-heading" className="mt-16 border-t border-border-soft pt-10">
            <h2 id="recommendations-heading" className="font-mono text-base font-bold text-primary">
              Colecionadores também viram
            </h2>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {recommendedItems.map((nft) => (
                <article
                  key={nft.id}
                  className="group relative min-w-0 overflow-hidden rounded-xl border border-border/40 bg-card p-3 transition duration-200 hover:-translate-y-1 hover:border-primary/50"
                >
                  <Link
                    to="/nfts/$nftId"
                    params={{ nftId: nft.id }}
                    aria-label={`Ver detalhes de ${nft.name}`}
                    className="block min-w-0 focus-visible:outline-none"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-raised">
                      <img
                        src={nft.imageUrl}
                        alt={nft.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="mt-2.5">
                      <h3 className="truncate font-mono text-xs font-bold text-foreground">
                        {nft.name}
                      </h3>
                      <p className="mt-1 font-mono text-xs font-bold text-primary">
                        {formatEth(nft.priceEth)} ETH
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            {/* Indicador de Paginação Visual (3 pontos: o • o) */}
            <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
              <span className="size-2 rounded-full border border-border-soft bg-transparent" />
              <span className="size-2 rounded-full bg-primary" />
              <span className="size-2 rounded-full border border-border-soft bg-transparent" />
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

/**
 * Linha de item unificada:
 * - Em Mobile (< md): Estilizada como Card arredondado com borda e espaçamento (Figma Mobile 390px).
 * - Em Desktop (>= md): Estilizada como Linha de Tabela com colunas fixas e divisores (Figma Desktop 1440px).
 * Sem duplicação de IDs ou TestIDs para garantir conformidade estrita com o Playwright.
 */
function CartItemUnifiedRow({
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
      className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:grid md:grid-cols-[1fr_120px_140px_120px_44px] md:items-center md:gap-4 md:rounded-none md:border-0 md:border-b md:border-border-soft md:bg-transparent md:p-0 md:py-4 transition"
    >
      {/* Coluna 1: Imagem + Nome + Token ID / Badges */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-surface-raised">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-mono text-sm font-bold text-foreground sm:text-base">
            <Link
              to="/nfts/$nftId"
              params={{ nftId: item.nftId }}
              className="hover:text-primary transition focus-visible:outline-1 focus-visible:outline-primary"
            >
              {item.name}
            </Link>
          </h3>

          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            ID do token: #{item.editionNumber || '0042'}
            <span className="md:hidden"> · Edição: {item.quantity}/{item.available}</span>
          </p>

          {/* Badges de Alteração ou Disponibilidade */}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.priceChanged && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                Preço alterado
              </span>
            )}
            {isSoldOut ? (
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                Esgotado
              </span>
            ) : isOverStock ? (
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                Apenas {item.available} disp.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Coluna 2: Preço Unitário (Desktop) */}
      <div className="hidden md:block font-mono text-sm text-foreground">
        {formatEth(item.unitPriceEth)} ETH
      </div>

      {/* Coluna 3: Edições / Controle Stepper (- Qtd +) */}
      <div className="flex items-center justify-between md:justify-center border-t border-border/30 pt-3 md:border-t-0 md:pt-0">
        <span className="font-mono text-xs text-muted-foreground md:hidden">Edições:</span>
        <div className="flex items-center gap-2">
          {/* Botão Diminuir */}
          <button
            type="button"
            disabled={item.quantity <= 1 || isMutating}
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            aria-label={`Diminuir quantidade de ${item.name}`}
            className={`grid size-7 sm:size-8 place-items-center rounded-full font-mono text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-primary ${
              item.quantity <= 1 || isMutating
                ? 'bg-surface-raised border border-border text-muted-foreground/40 cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary-light active:scale-95'
            }`}
          >
            −
          </button>

          {/* Valor da Quantidade */}
          <span
            data-testid={`item-qty-${item.nftId}`}
            aria-label={`Quantidade: ${item.quantity}`}
            className="w-7 sm:w-8 text-center font-mono text-xs sm:text-sm font-bold tabular-nums text-foreground"
          >
            {item.quantity}
          </span>

          {/* Botão Aumentar */}
          <button
            type="button"
            disabled={item.quantity >= item.available || isMutating}
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
            className={`grid size-7 sm:size-8 place-items-center rounded-full font-mono text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-primary ${
              item.quantity >= item.available || isMutating
                ? 'bg-surface-raised border border-border text-muted-foreground/40 cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary-light active:scale-95'
            }`}
          >
            +
          </button>
        </div>
      </div>

      {/* Coluna 4: Total do Item */}
      <div className="flex items-center justify-between md:justify-end border-t border-border/30 pt-2 md:border-t-0 md:pt-0">
        <span className="font-mono text-xs text-muted-foreground md:hidden">Total do item:</span>
        <span
          data-testid={`item-subtotal-${item.nftId}`}
          className="font-mono text-sm font-bold text-primary tabular-nums text-right"
        >
          {formatEth(item.subtotalEth)} ETH
        </span>
      </div>

      {/* Coluna 5: Ação de Remoção (Ícone Lixeira) */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={isMutating}
          aria-label={`Remover ${item.name} do carrinho`}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </li>
  )
}

function EmptyCartView() {
  return (
    <section aria-labelledby="empty-cart-heading" className="mx-auto max-w-lg py-16 text-center">
      <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-xl sm:p-12">
        <div aria-hidden="true" className="mx-auto grid size-16 place-items-center rounded-full bg-surface-raised text-primary">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-8">
            <path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="20" r="1.3" fill="currentColor" />
            <circle cx="18" cy="20" r="1.3" fill="currentColor" />
          </svg>
        </div>
        <h2 id="empty-cart-heading" className="mt-5 font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Seu carrinho está vazio
        </h2>
        <p className="mt-2 font-mono text-xs leading-5 text-muted-foreground sm:text-sm">
          Explore o catálogo e adicione edições de obras exclusivas à sua coleção digital.
        </p>
        <Link
          to="/"
          search={catalogSearchDefaults}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 font-mono text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary"
        >
          Explorar catálogo
        </Link>
      </div>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div role="status" aria-label="Carregando carrinho" className="grid gap-8 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="h-6 w-48 animate-shimmer rounded bg-surface-raised" />
        <div className="h-28 w-full animate-shimmer rounded-2xl bg-surface-raised" />
        <div className="h-28 w-full animate-shimmer rounded-2xl bg-surface-raised" />
        <div className="h-28 w-full animate-shimmer rounded-2xl bg-surface-raised" />
      </div>
      <div className="h-96 w-full animate-shimmer rounded-2xl sm:rounded-3xl bg-surface-raised" />
    </div>
  )
}

function TrashIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BackIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M15 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
