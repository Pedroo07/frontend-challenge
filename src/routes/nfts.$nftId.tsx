import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { HeartIcon, MarketplaceHeader } from '@/components/marketplace-header'
import { SiteFooter } from '@/components/site-footer'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { useFavorites } from '@/lib/favorites'
import { getNft, getNftList } from '@/lib/nft-api'
import { useNftSocket, useSocket } from '@/lib/socket-context'
import type { Nft, NftEdition, NftListItem } from '@/mocks/contracts'

export const Route = createFileRoute('/nfts/$nftId')({ component: NftDetailPage })

function NftDetailPage() {
  const { nftId } = Route.useParams()

  const nftQuery = useQuery({
    queryKey: ['nfts', 'detail', nftId],
    queryFn: ({ signal }) => getNft(nftId, signal),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const isNotFound = axios.isAxiosError(nftQuery.error) && nftQuery.error.response?.status === 404

  return (
    <div className="min-h-svh overflow-x-clip bg-background max-sm:bg-card font-mono text-foreground">
      <MarketplaceHeader activeNav="mercado" showMobileTabBar={false} showMobileHeader={false} />

      <main className="mx-auto w-full max-w-300 px-4 py-4 sm:px-6 sm:py-6 lg:px-0">
        <nav aria-label="Navegação estrutural" className="hidden items-center gap-2 pb-4 text-xs text-muted-foreground md:flex">
          <Link
            to="/"
            search={{ ...catalogSearchDefaults }}
            className="transition-colors hover:text-foreground"
          >
            Início
          </Link>
          <span aria-hidden="true" className="text-border-soft">/</span>
          <Link
            to="/"
            hash="catalog"
            search={{ ...catalogSearchDefaults }}
            className="text-foreground transition-colors hover:text-primary"
          >
            Mercado
          </Link>
        </nav>

        {nftQuery.isPending && <NftDetailSkeleton />}

        {nftQuery.isError && (
          <section
            role={isNotFound ? 'region' : 'alert'}
            aria-label={isNotFound ? 'NFT não encontrado' : 'Erro ao carregar obra'}
            className="mx-auto grid min-h-[50vh] max-w-xl place-items-center py-12 text-center"
          >
            <div className="w-full rounded-2xl border border-border-soft bg-card px-7 py-10 shadow-lg sm:px-12">
              <div
                aria-hidden="true"
                className="mx-auto grid size-14 place-items-center rounded-full bg-surface-raised font-mono text-2xl text-primary"
              >
                {isNotFound ? '⌕' : '!'}
              </div>
              <h1 className="mt-5 font-mono text-2xl font-bold tracking-tight text-foreground">
                {isNotFound ? 'NFT não encontrado' : 'Não foi possível carregar esta obra'}
              </h1>
              <p className="mt-2 font-mono text-xs leading-6 text-muted-foreground">
                {isNotFound
                  ? 'Este endereço não corresponde a uma obra do catálogo.'
                  : 'A conexão falhou. Você pode tentar novamente.'}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                {!isNotFound && (
                  <button
                    type="button"
                    onClick={() => void nftQuery.refetch()}
                    className="rounded bg-primary px-4 py-2.5 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Tentar novamente
                  </button>
                )}
                <Link
                  to="/"
                  search={{ ...catalogSearchDefaults }}
                  className="rounded border border-border-soft bg-surface-raised px-4 py-2.5 font-mono text-xs font-bold text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Explorar catálogo
                </Link>
              </div>
            </div>
          </section>
        )}

        {nftQuery.data && <NftDetailView key={nftQuery.data.id} nft={nftQuery.data} />}
      </main>

      <SiteFooter />
    </div>
  )
}

function NftDetailView({ nft }: { nft: Nft }) {
  const [selectedEditionId, setSelectedEditionId] = useState(nft.editions[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [addedSuccess, setAddedSuccess] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeThumbnailIndex, setActiveThumbnailIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details')
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null)

  const { isFavorite, toggleFavorite, isPending: favPending, pendingNftId, error: favoriteError } = useFavorites()
  const { addItem, isMutating } = useCart()
  const { updatedNfts, clearUpdatedNotice } = useSocket()

  const isFav = isFavorite(nft.id)
  const isToggling = favPending && pendingNftId === nft.id

  useNftSocket(nft.id, (event) => {
    setRealtimeNotice(`⚡ Preço e estoque atualizados em tempo real (${formatEth(event.priceEth)} ETH · ${event.available} disp.)`)
  })

  useEffect(() => {
    const update = updatedNfts[nft.id]
    if (update) {
      queueMicrotask(() => {
        setRealtimeNotice(`⚡ Atualização em tempo real: ${formatEth(update.priceEth)} ETH · ${update.available} disponíveis.`)
      })
    }
  }, [updatedNfts, nft.id])

  const edition = nft.editions.find((option) => option.id === selectedEditionId) ?? nft.editions[0]
  const available = edition?.available ?? 0

  useEffect(() => {
    if (available > 0 && quantity > available) {
      queueMicrotask(() => {
        setQuantity(available)
      })
    }
  }, [available, quantity])

  const setBoundedQuantity = (value: number) => {
    if (!Number.isFinite(value)) return
    setQuantity(Math.max(1, Math.min(available || 1, Math.floor(value))))
  }

  const selectEdition = (next: NftEdition) => {
    setSelectedEditionId(next.id)
    setQuantity(1)
    setAddedSuccess(false)
    setActionError(null)
  }

  const handleAddToCart = async () => {
    if (!edition || available <= 0) return
    setActionError(null)
    setAddedSuccess(false)
    try {
      await addItem({ nftId: nft.id, editionId: edition.id, quantity })
      setAddedSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setActionError(String(err.response.data.message))
      } else {
        setActionError('Não foi possível adicionar ao carrinho.')
      }
    }
  }

  const galleryThumbnails = [
    nft.imageUrl,
    nft.imageUrl,
    nft.imageUrl,
    nft.imageUrl,
  ]
  const currentImage = galleryThumbnails[activeThumbnailIndex] ?? nft.imageUrl

  const tokenNumber = nft.name.match(/#\s*([\w-]+)/)?.[1] ?? nft.id.replace(/^nft-/, '')
  const attributesList = [
    nft.collection.name,
    nft.network === 'ethereum' ? 'Ethereum ERC-721' : nft.network === 'polygon' ? 'Polygon ERC-721' : 'Solana Metaplex',
    available <= 1 ? 'Raro' : 'Verificado',
    edition?.name ?? 'Edição Limitada',
  ]

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://kurio.market/nfts/${nft.id}`

  return (
    <article className="pb-16 pt-2">
      {realtimeNotice && (
        <div
          role="region"
          aria-label="Atualização em tempo real"
          aria-live="polite"
          className="mb-6 flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/10 px-4 py-3 font-mono text-xs text-primary"
        >
          <span>{realtimeNotice}</span>
          <button
            type="button"
            onClick={() => {
              setRealtimeNotice(null)
              clearUpdatedNotice(nft.id)
            }}
            aria-label="Fechar aviso de atualização"
            className="text-foreground hover:text-primary"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between md:hidden">
        <Link
          to="/"
          search={{ ...catalogSearchDefaults }}
          aria-label="Voltar ao catálogo"
          className="grid size-11 place-items-center rounded-full border border-border-soft bg-card text-foreground shadow-sm transition hover:border-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <button
          type="button"
          aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`}
          aria-pressed={isFav}
          disabled={isToggling}
          onClick={() => void toggleFavorite(nft)}
          className={`grid size-11 place-items-center rounded-full border border-border-soft bg-card shadow-sm transition hover:border-primary ${
            isFav ? 'text-primary border-primary' : 'text-foreground'
          }`}
        >
          <HeartIcon className="size-5" filled={isFav} />
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:items-start lg:gap-12 pb-28 md:pb-0">
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
          <div
            role="tablist"
            aria-label="Miniaturas da obra"
            className="hidden md:flex md:flex-col md:overflow-visible md:pb-0 gap-2"
          >
            {galleryThumbnails.map((thumbUrl, idx) => {
              const isSelected = activeThumbnailIndex === idx
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`Visualizar imagem ${idx + 1} de ${nft.name}`}
                  onClick={() => setActiveThumbnailIndex(idx)}
                  className={`group relative size-16 shrink-0 overflow-hidden rounded-md border bg-card transition-all focus-visible:outline-2 focus-visible:outline-primary sm:size-20 ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/80'
                      : 'border-border-soft opacity-65 hover:opacity-100'
                  }`}
                >
                  <img
                    src={thumbUrl}
                    alt={`Miniatura ${idx + 1}`}
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              )
            })}
          </div>

          <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-3xl border border-border-soft bg-card shadow-2xl">
            <img
              src={currentImage}
              alt={`${nft.name}, obra da coleção ${nft.collection.name}`}
              width={720}
              height={720}
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover"
            />

            <button
              type="button"
              aria-label={`Ampliar visualização de ${nft.name}`}
              onClick={() => setLightboxOpen(true)}
              className="absolute right-3.5 top-3.5 grid size-9 place-items-center rounded-full border border-border-soft bg-background/80 text-foreground backdrop-blur-md transition-all hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary sm:size-10"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 sm:size-5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[34px]">
              {nft.name}
            </h1>

            <div className="flex items-center gap-1.5 rounded-full border border-border-soft bg-card px-2.5 py-1 text-xs text-warning md:hidden">
              <span aria-hidden="true">★</span>
              <span className="font-bold text-foreground">4.8</span>
              <span className="text-[10px] text-muted-foreground">(19)</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="font-mono text-2xl font-bold tracking-tighter text-primary sm:text-3xl tabular-nums ">
              {formatEth(edition?.priceEth ?? '0')} ETH
            </p>

            <div className="hidden items-center gap-2 font-mono text-sm text-muted-foreground md:flex">
              <div className="flex items-center text-warning text-lg sm:text-xl tracking-wider" aria-label="Avaliação: 5 de 5 estrelas">
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>
              <span className="text-foreground/80">19 avaliações de colecionadores</span>
            </div>
          </div>

          <div className="hidden md:block my-1 border-b border-border-soft" />

          <div className="space-y-4 rounded-3xl bg-card p-5 md:bg-transparent md:p-0 md:space-y-5">
            <div>
              <p className="font-mono text-xs leading-6 text-muted-foreground/90 sm:text-sm sm:leading-7">
                {nft.description}
              </p>
            </div>

            <section aria-labelledby="edition-heading" className="pt-2 md:pt-5">
              <div className="flex items-center justify-between gap-2">
                <h2 id="edition-heading" className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Edição:
                </h2>
                <span className="hidden md:inline font-mono text-[11px] text-muted-foreground">
                  {nft.editions.length} opções disponíveis
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {nft.editions.map((option) => {
                  const selected = option.id === edition?.id
                  const soldOut = option.available === 0
                  const shortLabel = option.supply >= 100 ? 'ABERTA' : `1/${option.supply}`

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={soldOut}
                      onClick={() => selectEdition(option)}
                      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-all focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? 'border-primary text-primary font-bold'
                          : 'border-border-soft bg-surface-raised/40 text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      <span>{shortLabel}</span>
                      {soldOut && (
                        <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                          Esgotado
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="space-y-1.5 pt-2 font-mono text-xs text-muted-foreground">
              <p>
                <span className="text-muted-foreground">ID do token:</span>{' '}
                <span className="text-foreground">#{edition?.id?.slice(0, 4) || '0042'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Coleção:</span>{' '}
                <span className="text-foreground">{nft.collection.name}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Atributos:</span>{' '}
                <span className="text-foreground">
                  {attributesList.length > 0 ? attributesList.join(', ') : 'Óculos, Esmeralda, Raro'}
                </span>
              </p>
            </div>
          </div>

          <div className="hidden md:block mt-6 rounded-xl border border-border-soft bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-muted-foreground">Qtd.</span>
                <div className="flex items-center gap-1.5" aria-label="Quantidade da edição">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={available === 0 || quantity <= 1}
                    onClick={() => setBoundedQuantity(quantity - 1)}
                    className="grid size-8 place-items-center rounded-full border border-border-soft bg-surface-raised font-mono text-sm font-bold text-foreground transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    −
                  </button>
                  <label className="sr-only" htmlFor="quantity">
                    Quantidade
                  </label>
                  <input
                    id="quantity"
                    role="spinbutton"
                    aria-label="Quantidade"
                    type="number"
                    min={1}
                    max={Math.max(available, 1)}
                    step={1}
                    disabled={available === 0}
                    value={quantity}
                    onChange={(event) => setBoundedQuantity(Number(event.currentTarget.value))}
                    className="w-10 bg-transparent text-center font-mono text-sm font-bold tabular-nums text-foreground outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={available === 0 || quantity >= available}
                    onClick={() => setBoundedQuantity(quantity + 1)}
                    className="grid size-8 place-items-center rounded-full border border-border-soft bg-surface-raised font-mono text-sm font-bold text-foreground transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 sm:flex-initial">
                <button
                  type="button"
                  disabled={available === 0 || isMutating}
                  onClick={() => void handleAddToCart()}
                  aria-label={available === 0 ? 'Edição esgotada' : 'Comprar'}
                  className="flex h-11 min-w-28 flex-1 items-center justify-center rounded bg-primary px-5 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground shadow transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
                >
                  {available === 0 ? 'Esgotado' : 'COMPRAR'}
                </button>

                <button
                  type="button"
                  aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`}
                  aria-pressed={isFav}
                  disabled={isToggling}
                  onClick={() => void toggleFavorite(nft)}
                  className={`inline-flex h-11 items-center gap-2 rounded border px-4 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 ${
                    isFav
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-soft bg-surface-raised text-muted-foreground hover:border-primary hover:text-foreground'
                  }`}
                >
                  <HeartIcon className="size-4" filled={isFav} />
                  <span>{isFav ? 'Favorito' : 'Favoritar'}</span>
                </button>
              </div>
            </div>

            <p className={`mt-3 font-mono text-xs ${available > 0 ? 'text-secondary' : 'text-destructive font-bold'}`}>
              {available > 0 ? `Estoque: ${available} de ${edition?.supply ?? 1} disponíveis nesta edição` : 'Aviso: Esta edição está esgotada no momento.'}
            </p>
          </div>

          <div className="fixed bottom-0 inset-x-0 z-40 bg-[#170e0a] border-t border-border-soft/60 px-5 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] md:hidden">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-muted-foreground">Qtd.</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={available === 0 || quantity <= 1}
                    onClick={() => setBoundedQuantity(quantity - 1)}
                    aria-label="Diminuir quantidade mobile"
                    className="grid size-7 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono text-sm font-bold text-foreground tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={available === 0 || quantity >= available}
                    onClick={() => setBoundedQuantity(quantity + 1)}
                    aria-label="Aumentar quantidade mobile"
                    className="grid size-7 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              <span className="font-mono text-lg font-bold text-primary tabular-nums">
                {formatEth(edition?.priceEth ?? '0')} ETH
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={available === 0 || isMutating}
                onClick={() => void handleAddToCart()}
                className="flex-1 h-12 rounded-2xl bg-primary font-mono text-sm font-bold text-primary-foreground shadow transition hover:bg-primary-light disabled:opacity-40"
              >
                {isMutating ? 'Processando...' : 'Comprar NFT'}
              </button>
              <button
                type="button"
                disabled={available === 0 || isMutating}
                onClick={() => void handleAddToCart()}
                aria-label="Adicionar ao carrinho"
                className="size-12 rounded-2xl border border-border-soft bg-card grid place-items-center text-foreground hover:border-primary disabled:opacity-40"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                  <path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="20" r="1.3" fill="currentColor" />
                  <circle cx="18" cy="20" r="1.3" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

            {addedSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 flex items-center justify-between rounded bg-success/10 px-3.5 py-2.5 font-mono text-xs font-semibold text-success"
              >
                <span>{quantity} {quantity === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho!</span>
                <Link to="/carrinho" className="underline hover:text-success">
                  Ver carrinho →
                </Link>
              </div>
            )}

            {favoriteError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-3 rounded border border-destructive/40 bg-destructive/15 px-3.5 py-2.5 font-mono text-xs text-destructive"
              >
                {favoriteError}
              </div>
            )}

            {actionError && (
              <div role="alert" className="mt-3 rounded bg-destructive/15 px-3.5 py-2.5 font-mono text-xs text-destructive">
                {actionError}
              </div>
            )}

            <div className="hidden md:block mt-6 space-y-2 border-t border-border-soft pt-5 font-mono text-xs text-muted-foreground">
              <p>
              <span className="text-muted-foreground">ID do token: </span>
              <strong className="text-foreground">#{tokenNumber}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Coleção: </span>
              <strong className="text-foreground">{nft.collection.name}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Atributos: </span>
              <strong className="text-foreground">{attributesList.join(', ')}</strong>
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span>Compartilhar este NFT:</span>
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Compartilhar no LinkedIn"
                  className="text-muted-foreground transition hover:text-primary"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.8v8.37h-2.8v-8.37M7.86 6.81a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9z" />
                  </svg>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(`Confira ${nft.name} na Kurio Marketplace: ${shareUrl}`)}`}
                  aria-label="Compartilhar via mensagem"
                  className="text-muted-foreground transition hover:text-primary"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Confira ${nft.name} na Kurio Marketplace`)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Compartilhar no X (Twitter)"
                  className="text-muted-foreground transition hover:text-primary"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-14 border-t border-border-soft pt-8" aria-label="Informações aprofundadas da obra">
        <div role="tablist" aria-label="Abas informativas" className="flex items-center gap-8 border-b border-border-soft pb-3 font-mono text-sm font-semibold">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            onClick={() => setActiveTab('details')}
            className={`relative pb-3 transition-colors ${
              activeTab === 'details'
                ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Detalhes do NFT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            className={`relative pb-3 transition-colors ${
              activeTab === 'reviews'
                ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Avaliações de colecionadores (19)
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="mt-6 max-w-3xl space-y-5 font-mono text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
            <p>
              {nft.name} é uma obra digital finalizada à mão da coleção {nft.collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na blockchain. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.
            </p>
            <p>
              A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador da obra recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.
            </p>
            <div className="space-y-3 pt-2 text-xs">
              <p>
                <strong className="block text-foreground">Rede:</strong>
                Cunhado na rede {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.
              </p>
              <p>
                <strong className="block text-foreground">Contrato:</strong>
                Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
              </p>
              <p>
                <strong className="block text-foreground">Direitos autorais:</strong>
                0x7A42...19E8 - Contrato inteligente ERC-721 verificado.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 max-w-3xl space-y-4 font-mono text-xs">
            <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-card p-4">
              <div className="text-2xl font-bold text-foreground">4.8</div>
              <div>
                <div className="flex text-warning">★★★★★</div>
                <p className="mt-0.5 text-muted-foreground">Com base em 19 avaliações de colecionadores verificados</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <CollectorReview
                collector="0x9B12...3A"
                date="18 de outubro de 2026"
                rating={5}
                comment="A iluminação e o nível de acabamento dos traços digitais são impressionantes na tela retina. Vale cada fração de ETH."
              />
              <CollectorReview
                collector="0x4C87...F1"
                date="12 de outubro de 2026"
                rating={5}
                comment="Procedência verificada na rede sem falhas. Um dos lançamentos mais fortes da coleção Kurio."
              />
            </div>
          </div>
        )}
      </section>

      <MoreFromCollectionSection currentNft={nft} />

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada de ${nft.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-border-soft bg-card p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fechar visualização ampliada"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-background/80 font-mono text-sm text-foreground backdrop-blur-md transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              ✕
            </button>
            <img
              src={currentImage}
              alt={nft.name}
              width={900}
              height={900}
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </article>
  )
}

function CollectorReview({
  collector,
  date,
  rating,
  comment,
}: {
  collector: string
  date: string
  rating: number
  comment: string
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{collector}</span>
        <span className="text-[10px] text-muted-foreground">{date}</span>
      </div>
      <div className="mt-1 flex text-warning">
        {Array.from({ length: rating }).map((_, i) => (
          <span key={i}>★</span>
        ))}
      </div>
      <p className="mt-2 text-muted-foreground">{comment}</p>
    </div>
  )
}

function MoreFromCollectionSection({ currentNft }: { currentNft: Nft }) {
  const [activePageIndex, setActivePageIndex] = useState(0)

  const relatedQuery = useQuery({
    queryKey: ['nfts', 'related', currentNft.collection.id],
    queryFn: ({ signal }) =>
      getNftList(
        {
          ...catalogSearchDefaults,
          collection: currentNft.collection.id,
          page: 1,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

  const fallbackQuery = useQuery({
    queryKey: ['nfts', 'catalog-recommendations'],
    queryFn: ({ signal }) =>
      getNftList(
        {
          ...catalogSearchDefaults,
          page: 1,
        },
        signal,
      ),
    enabled: (relatedQuery.data?.items.filter((item) => item.id !== currentNft.id).length ?? 0) < 4,
    placeholderData: keepPreviousData,
  })

  const rawItems = relatedQuery.data?.items.filter((item) => item.id !== currentNft.id) ?? []
  const combinedItems = rawItems.length >= 4 ? rawItems : (fallbackQuery.data?.items.filter((item) => item.id !== currentNft.id) ?? rawItems)

  const pageSize = 5
  const total = combinedItems.length
  const startIndex = (activePageIndex * pageSize) % Math.max(1, total)
  const displayItems = total <= pageSize
    ? combinedItems
    : Array.from({ length: Math.min(pageSize, total) }, (_, i) => combinedItems[(startIndex + i) % total]!)

  if (displayItems.length === 0) {
    return null
  }

  return (
    <section className="mt-16 border-t border-border-soft pt-10" aria-labelledby="more-collection-heading">
      <h2 id="more-collection-heading" className="font-mono text-base font-bold text-primary sm:text-lg">
        Mais desta coleção
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {displayItems.map((item) => (
          <CollectionPreviewCard key={item.id} nft={item} />
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-2" aria-label="Navegação de recomendações">
        {[0, 1, 2].map((idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Página ${idx + 1}`}
            onClick={() => setActivePageIndex(idx)}
            className={`size-2 rounded-full transition-all ${
              activePageIndex === idx ? 'bg-primary scale-125' : 'bg-border-soft hover:bg-muted-foreground'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function CollectionPreviewCard({ nft }: { nft: NftListItem }) {
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-md bg-card transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        aria-label={`Ver detalhes de ${nft.name}`}
        className="block min-w-0 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-raised">
          <img
            src={nft.imageUrl}
            alt={`${nft.name}, obra da coleção ${nft.collection.name}`}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="p-3">
          <h3 className="truncate font-mono text-xs font-semibold leading-5 text-foreground sm:text-sm">
            {nft.name}
          </h3>
          <p className="mt-1 font-mono text-xs font-bold text-primary tabular-nums">
            {formatEth(nft.priceEth)} ETH
          </p>
        </div>
      </Link>
    </article>
  )
}

function NftDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando detalhes do NFT"
      className="pb-16 pt-2"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-12">
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start">
          <div className="flex gap-2 md:flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="size-16 animate-shimmer rounded-md sm:size-20" />
            ))}
          </div>
          <div className="aspect-square w-full animate-shimmer rounded-2xl sm:rounded-3xl" />
        </div>

        <div className="space-y-4 pt-2">
          <div className="h-8 w-3/4 animate-shimmer rounded" />
          <div className="h-7 w-32 animate-shimmer rounded" />
          <div className="h-20 w-full animate-shimmer rounded-md" />
          <div className="h-14 w-full animate-shimmer rounded-md" />
          <div className="h-28 w-full animate-shimmer rounded-xl" />
          <div className="h-16 w-full animate-shimmer rounded-md" />
        </div>
      </div>
    </div>
  )
}
