import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import axios from 'axios'
import { useState } from 'react'
import { HeartIcon, MarketplaceHeader } from '@/components/marketplace-header'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { useFavorites } from '@/lib/favorites'
import { getNft } from '@/lib/nft-api'
import type { Nft, NftEdition } from '@/mocks/contracts'

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
    <div className="min-h-svh overflow-x-clip bg-background text-foreground">
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-9 lg:px-10">
        <Link
          to="/"
          search={{ ...catalogSearchDefaults }}
          className="inline-flex items-center gap-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span aria-hidden="true">←</span> Voltar ao catálogo
        </Link>

        {nftQuery.isPending && <NftDetailSkeleton />}

        {nftQuery.isError && (
          <section role={isNotFound ? undefined : 'alert'} className="mx-auto grid min-h-[60vh] max-w-xl place-items-center py-12 text-center">
            <div className="rounded-3xl border border-border bg-white px-7 py-10 shadow-sm sm:px-12">
              <div aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-2xl text-primary">{isNotFound ? '⌕' : '!'}</div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">{isNotFound ? 'NFT não encontrado' : 'Não foi possível carregar esta obra'}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isNotFound ? 'Este endereço não corresponde a uma obra do catálogo.' : 'A conexão falhou. Você pode tentar novamente.'}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                {!isNotFound && <button type="button" onClick={() => void nftQuery.refetch()} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tentar novamente</button>}
                <Link to="/" search={{ ...catalogSearchDefaults }} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Explorar catálogo</Link>
              </div>
            </div>
          </section>
        )}

        {nftQuery.data && <NftDetailView key={nftQuery.data.id} nft={nftQuery.data} />}
      </main>
    </div>
  )
}

function NftDetailView({ nft }: { nft: Nft }) {
  const [editionId, setEditionId] = useState(nft.editions[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [addedSuccess, setAddedSuccess] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { isFavorite, toggleFavorite, isPending, pendingNftId, error: favoriteError } = useFavorites()
  const { addItem, isMutating } = useCart()
  const isFav = isFavorite(nft.id)
  const isToggling = isPending && pendingNftId === nft.id

  const edition = nft.editions.find((option) => option.id === editionId) ?? nft.editions[0]
  const available = edition?.available ?? 0

  const setBoundedQuantity = (value: number) => {
    if (!Number.isFinite(value)) return
    setQuantity(Math.max(1, Math.min(available || 1, Math.floor(value))))
  }

  const selectEdition = (next: NftEdition) => {
    setEditionId(next.id)
    setQuantity(1)
    setAddedSuccess(false)
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

  return (
    <article className="pb-12 pt-6 sm:pt-8">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-start lg:gap-12 xl:gap-18">
        <div className="overflow-hidden rounded-[28px] border border-border bg-white p-2.5 shadow-[0_12px_40px_rgba(39,33,85,0.07)] sm:p-4">
          <img src={nft.imageUrl} alt={`${nft.name}, arte da coleção ${nft.collection.name}`} className="aspect-square w-full rounded-[20px] object-cover" />
          <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4 text-xs text-muted-foreground sm:px-3 sm:text-sm">
            <span>Obra digital</span>
            <span>{nft.editions.length} opções de edição</span>
          </div>
        </div>

        <div className="pt-1 sm:pt-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.19em] text-primary">{nft.collection.name}</p>
            <button
              type="button"
              aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`}
              aria-pressed={isFav}
              disabled={isToggling}
              onClick={() => void toggleFavorite(nft)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${isFav ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
            >
              <HeartIcon className="size-4" filled={isFav} />
              <span>{isFav ? 'Favorito' : 'Favoritar'}</span>
            </button>
          </div>

          {favoriteError && (
            <div role="alert" aria-live="assertive" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 font-mono text-xs text-destructive">
              {favoriteError}
            </div>
          )}

          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">{nft.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Criada por <span className="font-medium text-foreground">{nft.creator}</span></p>

          <div className="mt-6 border-y border-border py-5">
            <p className="text-sm leading-7 text-muted-foreground">{nft.description}</p>
          </div>

          <section aria-labelledby="edition-heading" className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="edition-heading" className="text-sm font-semibold">Edição</h2>
              <span className="text-xs text-muted-foreground">{nft.editions.length} disponíveis no catálogo</span>
            </div>
            <div className="mt-3 grid gap-2">
              {nft.editions.map((option) => {
                const selected = option.id === edition?.id
                const soldOut = option.available === 0
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={soldOut}
                    onClick={() => selectEdition(option)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 ${selected ? 'border-primary bg-primary/4.5 ring-1 ring-primary/20' : 'border-border bg-white hover:border-primary/40'}`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{option.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Edição {option.editionNumber} · {option.available} de {option.supply} disponíveis</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatEth(option.priceEth)} ETH</span>
                  </button>
                )
              })}
            </div>
          </section>

          {edition && (
            <>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-border sm:px-5">
                <div>
                  <p className="text-xs text-muted-foreground">Preço desta edição</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatEth(edition.priceEth)} <span className="text-base font-medium">ETH</span></p>
                  <p className={`mt-1 text-xs ${available > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {available > 0 ? `${available} unidades disponíveis` : 'Edição esgotada'}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border p-1" aria-label="Quantidade da edição">
                  <button type="button" aria-label="Diminuir quantidade" disabled={available === 0 || quantity <= 1} onClick={() => setBoundedQuantity(quantity - 1)} className="grid size-9 place-items-center rounded-md text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">−</button>
                  <label className="sr-only" htmlFor="quantity">Quantidade</label>
                  <input
                    id="quantity"
                    aria-label="Quantidade"
                    type="number"
                    min={1}
                    max={Math.max(available, 1)}
                    step={1}
                    disabled={available === 0}
                    value={quantity}
                    onChange={(event) => setBoundedQuantity(Number(event.currentTarget.value))}
                    className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none disabled:opacity-50"
                  />
                  <button type="button" aria-label="Aumentar quantidade" disabled={available === 0 || quantity >= available} onClick={() => setBoundedQuantity(quantity + 1)} className="grid size-9 place-items-center rounded-md text-lg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">+</button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={available === 0 || isMutating}
                  onClick={() => void handleAddToCart()}
                  aria-label={available === 0 ? 'Edição esgotada' : `Adicionar ${quantity} ${quantity === 1 ? 'unidade' : 'unidades'} ao carrinho`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5"><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.3" fill="currentColor" /><circle cx="18" cy="20" r="1.3" fill="currentColor" /></svg>
                  {available === 0 ? 'Edição esgotada' : isMutating ? 'Adicionando ao carrinho...' : 'Adicionar ao carrinho'}
                </button>

                {addedSuccess && (
                  <div role="status" aria-live="polite" className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                    <span>{quantity} {quantity === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho!</span>
                    <Link to="/carrinho" className="underline hover:opacity-80">
                      Ver carrinho →
                    </Link>
                  </div>
                )}

                {actionError && (
                  <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {actionError}
                  </div>
                )}
              </div>
            </>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-3 rounded-xl border border-border bg-white p-4 text-xs sm:p-5">
            <div><dt className="text-muted-foreground">Coleção</dt><dd className="mt-1 font-semibold">{nft.collection.name}</dd></div>
            <div><dt className="text-muted-foreground">Identificador</dt><dd className="mt-1 break-all font-semibold">{nft.id}</dd></div>
          </dl>
        </div>
      </div>
    </article>
  )
}

function NftDetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando detalhes do NFT" className="grid gap-7 pb-12 pt-6 lg:grid-cols-2 lg:gap-12 lg:pt-8">
      <div className="aspect-square animate-shimmer rounded-[28px] bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-size-[200%_100%]" />
      <div className="space-y-5 pt-3">
        <div className="h-3 w-28 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-size-[200%_100%]" />
        <div className="h-10 w-3/4 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-size-[200%_100%]" />
        <div className="h-20 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-size-[200%_100%]" />
        <div className="h-24 animate-shimmer rounded-xl bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-size-[200%_100%]" />
      </div>
    </div>
  )
}
