import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { formatEth, nftCollections, nftSortOptions, nftPageSize, validateCatalogSearch, type CatalogSearch } from '@/lib/catalog-options'
import { getNftList } from '@/lib/nft-api'
import { router } from '@/lib/router'
import type { NftListItem } from '@/mocks/contracts'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => validateCatalogSearch(search),
  component: CatalogPage,
})

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [searchInput, setSearchInput] = useState(search.q)
  const listQuery = useQuery({
    queryKey: ['nfts', 'list', search],
    queryFn: ({ signal }) => getNftList(search, signal),
    placeholderData: keepPreviousData,
    retry: false,
  })

  useEffect(() => router.subscribe('onResolved', ({ toLocation }) => {
    const q = (toLocation.search as Partial<CatalogSearch>).q
    setSearchInput(typeof q === 'string' ? q : '')
  }), [])

  useEffect(() => {
    const q = searchInput.trim().slice(0, 80)
    if (q === search.q) return

    const timer = window.setTimeout(() => {
      void navigate({ search: (current) => ({ ...current, q, page: 1 }) })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [navigate, search.q, searchInput])

  const updateSearch = (update: (current: CatalogSearch) => CatalogSearch) => {
    void navigate({ search: update })
  }

  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1)

  return (
    <div className="min-h-svh overflow-x-clip bg-background text-foreground">
      <MarketplaceHeader />

      <main>
        <section className="border-b border-[#eceaf5] bg-[radial-gradient(ellipse_at_top_right,_#e9e4ff_0,_#f8f7fc_42%,_#f7f8fa_76%)]">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-7 sm:py-16 lg:grid-cols-[1fr_0.65fr] lg:items-center lg:px-10 lg:py-[76px]">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <span className="size-2 rounded-full bg-primary" /> Colecionáveis digitais
              </p>
              <h1 className="max-w-xl text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[58px]">
                Descubra arte que <span className="text-primary">fica com você.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground sm:text-base">
                Explore obras digitais de artistas independentes e encontre uma peça para chamar de sua.
              </p>
            </div>

            <form className="relative w-full lg:justify-self-end lg:max-w-[480px]" role="search" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="nft-search">Buscar NFTs</label>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground">
                <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" />
                <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input
                id="nft-search"
                type="search"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.currentTarget.value)}
                placeholder="Nome, coleção ou artista"
                className="h-14 w-full rounded-xl border border-white bg-white pl-12 pr-4 text-sm shadow-[0_8px_28px_rgba(49,42,98,0.08)] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </form>
          </div>
        </section>

        <section id="catalog" aria-labelledby="catalog-heading" className="mx-auto max-w-[1440px] px-4 py-9 sm:px-7 sm:py-12 lg:px-10">
          <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">O catálogo</p>
              <h2 id="catalog-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">Peças em destaque</h2>
            </div>
            <p className="text-sm text-muted-foreground">Obras selecionadas de artistas independentes</p>
          </div>

          <div id="collections" className="mb-6 grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-[minmax(180px,1fr)_minmax(160px,0.7fr)_auto_minmax(165px,0.65fr)] sm:items-center sm:px-5">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Coleção
              <select
                aria-label="Coleção"
                value={search.collection}
                onChange={(event) => {
                  const collection = event.currentTarget.value as CatalogSearch['collection']
                  updateSearch((current) => ({ ...current, collection, page: 1 }))
                }}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                <option value="all">Todas as coleções</option>
                {nftCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Ordenar por
              <select
                aria-label="Ordenar por"
                value={search.sort}
                onChange={(event) => {
                  const sort = event.currentTarget.value as CatalogSearch['sort']
                  updateSearch((current) => ({ ...current, sort, page: 1 }))
                }}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {nftSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="flex min-h-10 items-center gap-2.5 self-end pb-2 text-sm text-foreground sm:justify-center">
              <input
                type="checkbox"
                checked={search.available}
                onChange={(event) => {
                  const available = event.currentTarget.checked
                  updateSearch((current) => ({ ...current, available, page: 1 }))
                }}
                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              Somente disponíveis
            </label>

            <button
              type="button"
              onClick={() => updateSearch(() => ({ q: '', collection: 'all', available: false, sort: 'newest', page: 1 }))}
              className="h-10 self-end rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Limpar filtros
            </button>
          </div>

          <div className="mb-4 flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
            <p>
              {listQuery.data ? `${listQuery.data.total} ${listQuery.data.total === 1 ? 'obra encontrada' : 'obras encontradas'}` : 'Carregando catálogo'}
            </p>
            {listQuery.isFetching && listQuery.data && <p role="status">Atualizando resultados…</p>}
          </div>

          {listQuery.isError && (
            <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
              <p>Não foi possível atualizar o catálogo. Tente novamente.</p>
              <button type="button" onClick={() => void listQuery.refetch()} className="w-fit rounded-lg bg-white px-4 py-2 font-semibold text-rose-900 ring-1 ring-rose-200 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">Tentar novamente</button>
            </div>
          )}

          {listQuery.isPending && <CatalogSkeleton />}

          {!listQuery.data && listQuery.isError && (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-white px-6 text-center">
              <div>
                <h3 className="text-lg font-semibold">O catálogo não carregou</h3>
                <p className="mt-2 text-sm text-muted-foreground">Sua seleção continua salva e você pode tentar outra vez.</p>
              </div>
            </div>
          )}

          {listQuery.data && listQuery.data.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-3 xl:gap-6">
              {listQuery.data.items.map((nft) => <NftCard key={nft.id} nft={nft} />)}
            </div>
          )}

          {listQuery.data && listQuery.data.items.length === 0 && (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-white px-6 text-center">
              <div className="max-w-sm">
                <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-primary">⌕</span>
                <h3 className="mt-4 text-lg font-semibold">Nenhuma obra encontrada</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Tente outra busca ou ajuste os filtros para explorar mais peças.</p>
                <button type="button" onClick={() => updateSearch(() => ({ q: '', collection: 'all', available: false, sort: 'newest', page: 1 }))} className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Limpar filtros</button>
              </div>
            </div>
          )}

          {listQuery.data && listQuery.data.totalPages > 1 && (
            <nav aria-label="Paginação do catálogo" className="mt-9 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={search.page <= 1 || listQuery.isFetching}
                onClick={() => updateSearch((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                className="grid size-10 place-items-center rounded-full border border-border bg-white text-lg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ‹
              </button>
              <span className="min-w-16 text-center text-sm font-medium tabular-nums">{search.page} / {totalPages}</span>
              <button
                type="button"
                aria-label="Próxima página"
                disabled={search.page >= totalPages || listQuery.isFetching}
                onClick={() => updateSearch((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
                className="grid size-10 place-items-center rounded-full border border-border bg-white text-lg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ›
              </button>
            </nav>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-10">
          <span>AURÉA · Galeria de arte digital</span>
          <span>Obras e coleções demonstrativas</span>
        </div>
      </footer>
    </div>
  )
}

function NftCard({ nft }: { nft: NftListItem }) {
  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: nft.id }}
      aria-label={`Ver detalhes de ${nft.name}`}
      className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-white transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_14px_34px_rgba(39,33,85,0.11)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <article>
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img src={nft.imageUrl} alt={`${nft.name}, arte da coleção ${nft.collection.name}`} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.035]" />
          {nft.available === 0 ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Esgotado</span>
          ) : (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 sm:text-xs">{nft.available} disponíveis</span>
          )}
        </div>
        <div className="p-3 sm:p-4">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-primary sm:text-xs">{nft.collection.name}</p>
          <h3 className="mt-1.5 truncate text-sm font-semibold leading-5 sm:text-base">{nft.name}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">por {nft.creator}</p>
          <div className="mt-4 flex items-end justify-between gap-1 border-t border-border pt-3">
            <span className="text-[10px] text-muted-foreground sm:text-xs">A partir de</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums sm:text-sm">{formatEth(nft.priceEth)} ETH</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

function CatalogSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFTs" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:gap-6">
      {Array.from({ length: nftPageSize }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="aspect-square animate-shimmer bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-[length:200%_100%]" />
          <div className="space-y-3 p-3 sm:p-4">
            <div className="h-2.5 w-1/3 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-[length:200%_100%]" />
            <div className="h-4 w-3/4 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-[length:200%_100%]" />
            <div className="h-3 w-1/2 animate-shimmer rounded bg-[linear-gradient(100deg,#eeedf3_30%,#faf9fc_50%,#eeedf3_70%)] bg-[length:200%_100%]" />
          </div>
        </div>
      ))}
    </div>
  )
}
