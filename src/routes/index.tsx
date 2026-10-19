import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { catalogSearchDefaults, nftCollections, nftNetworks, nftPageSize, nftSortOptions, validateCatalogSearch, type CatalogSearch } from '@/lib/catalog-options'
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
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  const setSort = (sort: CatalogSearch['sort']) => updateSearch((current) => ({ ...current, sort, page: 1 }))
  const resetFilters = () => updateSearch(() => ({ ...catalogSearchDefaults }))
  const totalPages = Math.max(1, listQuery.data?.totalPages ?? 1)
  const featured = listQuery.data?.items[0]
  const secondaryFeatured = listQuery.data?.items[1]

  return (
    <div id="top" className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader
        query={searchInput}
        onQueryChange={setSearchInput}
        filtersOpen={filtersOpen}
        onFiltersClick={() => setFiltersOpen((open) => !open)}
      />

      <main>
        <form role="search" aria-label="Busca do catálogo" className="sr-only" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="catalog-search-accessible">Buscar NFTs</label>
          <input id="catalog-search-accessible" type="search" value={searchInput} onChange={(event) => setSearchInput(event.currentTarget.value)} />
        </form>
        <Hero nft={featured} secondary={secondaryFeatured} loading={listQuery.isPending} onExplore={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })} />

        <section id="catalog" aria-labelledby="catalog-heading" className="mx-auto max-w-300 px-6 pb-24 pt-4 md:px-8 md:pb-16 md:pt-16 lg:px-0">
          <div className="grid min-w-0 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-9 xl:grid-cols-[310px_minmax(0,1fr)] xl:gap-12">
            <aside className="hidden min-w-0 lg:block" aria-label="Filtros do catálogo">
              <CatalogFilters search={search} onUpdate={updateSearch} onReset={resetFilters} />
            </aside>

            <div className="min-w-0">
              <div className="mb-2 flex min-w-0 flex-col gap-4 md:mb-4 md:flex-row md:items-center md:justify-between xl:mb-6">
                <div role="group" className="flex min-w-0 items-center gap-5 overflow-x-auto border-b border-border-soft pr-2 text-xs font-semibold sm:gap-6 sm:text-sm" aria-label="Ordenar catálogo">
                  <SortTab active={search.collection === 'all' && search.sort === 'newest'} onClick={() => updateSearch((current) => ({ ...current, collection: 'all', sort: 'newest', page: 1 }))}>Todos os NFTs</SortTab>
                  <SortTab active={search.collection !== 'all' && search.sort === 'newest'} onClick={() => setSort('newest')}>Novos lançamentos</SortTab>
                  <SortTab active={search.sort === 'price-desc'} onClick={() => setSort('price-desc')}>Em alta</SortTab>
                </div>

                <label className="hidden shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground sm:flex">
                  <span>Ordenar por:</span>
                  <select
                    aria-label="Ordenar por"
                    value={search.sort}
                    onChange={(event) => setSort(event.currentTarget.value as CatalogSearch['sort'])}
                    className="max-w-48 cursor-pointer border-0 bg-transparent py-2 font-mono text-xs text-foreground outline-none focus-visible:text-primary"
                  >
                    {nftSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="sr-only" aria-live="polite">
                <h2 id="catalog-heading">Peças em destaque</h2>
                <p>{listQuery.data ? `${listQuery.data.total} ${listQuery.data.total === 1 ? 'obra encontrada' : 'obras encontradas'}` : 'Carregando catálogo'}</p>
                {listQuery.isFetching && listQuery.data && <p role="status">Atualizando…</p>}
              </div>

              <div id="mobile-catalog-filters" hidden={!filtersOpen} className="mb-5 lg:hidden">
                <CatalogFilters search={search} onUpdate={updateSearch} onReset={resetFilters} compact />
              </div>

              {listQuery.isError && (
                <div role="alert" className="mb-6 flex flex-col gap-3 rounded-md border border-border-soft bg-card p-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>Não foi possível atualizar o catálogo. Tente novamente.</p>
                  <button type="button" onClick={() => void listQuery.refetch()} className="w-fit rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tentar novamente</button>
                </div>
              )}

              {listQuery.isPending && <CatalogSkeleton />}

              {!listQuery.data && listQuery.isError && (
                <div className="grid min-h-56 place-items-center rounded-md border border-border-soft bg-card px-6 text-center">
                  <div>
                    <h2 className="text-lg font-bold">O catálogo não carregou</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Sua busca continua salva. Você pode tentar outra vez.</p>
                  </div>
                </div>
              )}

              {listQuery.data && listQuery.data.items.length > 0 && (
                <div className="grid min-w-0 grid-cols-2 items-start gap-x-4 gap-y-7 [&>*:nth-child(even)]:translate-y-6 md:grid-cols-2 md:gap-x-5 md:gap-y-8 md:[&>*:nth-child(even)]:translate-y-0 xl:grid-cols-3 xl:gap-x-8 xl:gap-y-8">
                  {listQuery.data.items.map((nft) => <NftCard key={nft.id} nft={nft} />)}
                </div>
              )}

              {listQuery.data && listQuery.data.items.length === 0 && (
                <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-border-soft bg-card px-6 text-center">
                  <div className="max-w-sm">
                    <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-surface-raised text-primary">⌕</span>
                    <h2 className="mt-4 text-lg font-bold">Nenhuma obra encontrada</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Ajuste a busca ou os filtros para explorar outras peças.</p>
                    <button type="button" onClick={resetFilters} className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Limpar filtros</button>
                  </div>
                </div>
              )}

              {listQuery.data && listQuery.data.totalPages > 1 && (
                <nav aria-label="Paginação do catálogo" className="mt-10 flex items-center justify-end gap-2">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-current={search.page === page ? 'page' : undefined}
                      aria-label={`Página ${page}`}
                      disabled={listQuery.isFetching}
                      onClick={() => updateSearch((current) => ({ ...current, page }))}
                      className={`grid size-9 place-items-center rounded-sm border text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${search.page === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border-soft text-foreground hover:border-primary'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={search.page >= totalPages || listQuery.isFetching}
                    onClick={() => updateSearch((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
                    className="grid size-9 place-items-center rounded-sm border border-border-soft text-lg hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >›</button>
                </nav>
              )}
            </div>
          </div>
        </section>

        <PromoSection items={listQuery.data?.items ?? []} />
        <JournalSection items={listQuery.data?.items ?? []} />
      </main>

      <SiteFooter />
    </div>
  )
}

function Hero({ nft, secondary, loading, onExplore }: { nft?: NftListItem; secondary?: NftListItem; loading: boolean; onExplore: () => void }) {
  if (loading) return <HeroSkeleton />

  return (
    <section aria-labelledby="hero-heading" className="mx-auto max-w-300 px-6 pt-4 md:px-8 md:pt-0 lg:px-0">
      <div className="hero-mobile-surface relative min-h-[190px] overflow-hidden rounded-hero px-4 py-3 md:grid md:min-h-[500px] md:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] md:items-start md:gap-10 md:rounded-none md:bg-none md:px-10 md:py-0 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10">
        <div className="relative z-10 max-w-[57%] md:max-w-2xl md:pt-10">
          <p className="mb-2 font-mono text-[10px] font-medium tracking-wide text-foreground/80 md:mb-4 md:text-sm">Bem-vindo à Kurio</p>
          <h1 id="hero-heading" className="max-w-[520px] text-[19px] font-bold leading-[1.48] tracking-tight text-foreground md:text-4xl md:leading-[1.35] lg:text-[43px] lg:leading-[1.63]">
            <span className="md:hidden">SEJA DONO DA<br />CULTURA DIGITAL</span>
            <span className="hidden md:inline">SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</span>
          </h1>
          <p className="mt-2 max-w-[175px] font-mono text-[11px] leading-[1.45] text-muted-foreground md:mt-3 md:max-w-lg md:text-sm md:leading-6">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="hidden md:inline">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</span>
          </p>
          <button type="button" onClick={onExplore} className="mt-2 inline-flex h-8 items-center gap-2 rounded-sm bg-primary px-3.5 font-mono text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:mt-6 md:h-10 md:px-5 md:text-sm">
            EXPLORAR <span aria-hidden="true" className="md:hidden">→</span>
          </button>
        </div>

        {nft ? (
          <div className="absolute right-4 top-2 z-0 aspect-square w-[40%] overflow-hidden rounded-lg bg-surface-raised md:relative md:right-auto md:top-auto md:ml-auto md:mt-6 md:w-full md:max-w-[450px] md:rounded-hero">
            <img src={nft.imageUrl} alt={`${nft.name}, destaque da Kurio`} width={900} height={900} fetchPriority="high" decoding="async" className="size-full object-cover" />
            {secondary && (
              <div className="absolute -bottom-1 -left-2 aspect-square w-[42%] overflow-hidden rounded-lg border-2 border-card md:hidden">
                <img src={secondary.imageUrl} alt={`${secondary.name}, outra obra em destaque`} width={320} height={320} loading="eager" decoding="async" className="size-full object-cover" />
              </div>
            )}
          </div>
        ) : (
          <div aria-hidden="true" className="absolute right-4 top-2 aspect-square w-[40%] animate-shimmer rounded-lg md:relative md:right-auto md:top-auto md:ml-auto md:w-full md:max-w-[450px] md:rounded-hero" />
        )}

        <div aria-hidden="true" className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 md:bottom-4 md:left-[48%]">
          <span className="size-2 rounded-full bg-primary" />
          <span className="size-2 rounded-full bg-primary/70" />
          <span className="size-2 rounded-full bg-primary/70" />
        </div>
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <section aria-label="Carregando destaque" className="mx-auto max-w-300 px-6 pt-4 md:px-8 md:pt-0 lg:px-0">
      <div className="hero-mobile-surface min-h-[190px] overflow-hidden rounded-hero px-4 py-3 md:grid md:min-h-[500px] md:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] md:items-start md:gap-10 md:rounded-none md:bg-none md:px-10 md:py-0">
        <div className="flex h-[158px] max-w-[57%] flex-col justify-center gap-3 md:h-auto md:max-w-xl md:gap-5 md:pt-10 lg:max-w-2xl">
          <div className="h-3 w-28 animate-shimmer rounded-sm" />
          <div className="h-7 w-full animate-shimmer rounded-sm md:h-12" />
          <div className="h-3 w-4/5 animate-shimmer rounded-sm md:h-4" />
          <div className="h-8 w-20 animate-shimmer rounded-sm md:mt-2 md:h-10 md:w-28" />
        </div>
        <div aria-hidden="true" className="absolute right-4 top-2 aspect-square w-[40%] animate-shimmer rounded-lg md:relative md:right-auto md:top-auto md:ml-auto md:mt-6 md:w-full md:max-w-[450px] md:rounded-hero" />
      </div>
    </section>
  )
}

function SortTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`relative h-7 shrink-0 whitespace-nowrap font-mono text-xs transition-colors sm:h-10 sm:text-sm ${active ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  )
}

function CatalogFilters({ search, onUpdate, onReset, compact = false }: { search: CatalogSearch; onUpdate: (update: (current: CatalogSearch) => CatalogSearch) => void; onReset: () => void; compact?: boolean }) {
  return (
    <div className={`rounded-sm bg-card ${compact ? 'grid gap-5 p-4 sm:grid-cols-2' : 'p-5'}`}>
      <fieldset className="min-w-0">
        <legend className="mb-3 font-mono text-base font-bold text-foreground">Coleções</legend>
        <label className="sr-only" htmlFor={compact ? 'catalog-collection-mobile' : 'catalog-collection-desktop'}>Coleção</label>
        <select
          id={compact ? 'catalog-collection-mobile' : 'catalog-collection-desktop'}
          aria-label="Coleção"
          value={search.collection}
          onChange={(event) => onUpdate((current) => ({ ...current, collection: event.currentTarget.value as CatalogSearch['collection'], page: 1 }))}
          className="sr-only"
        >
          <option value="all">Todas as coleções</option>
          {nftCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </select>
        <div className="grid gap-1">
          <FilterCollection label="Todas as coleções" value="all" search={search} onUpdate={onUpdate} />
          {nftCollections.map((collection) => <FilterCollection key={collection.id} label={collection.name} value={collection.id} search={search} onUpdate={onUpdate} />)}
        </div>
      </fieldset>

      <fieldset className="min-w-0 border-t border-border-soft pt-4">
        <legend className="mb-3 font-mono text-sm font-bold text-foreground">Faixa de preço</legend>
        <div className="relative mx-2 mb-3 mt-5 h-1 rounded-full bg-border-soft">
          <div className="absolute inset-y-0 rounded-full bg-primary" style={{ left: `${((search.minPrice - 0.02) / 12.28) * 100}%`, right: `${((12.3 - search.maxPrice) / 12.28) * 100}%` }} />
          <input
            aria-label="Preço mínimo em ETH"
            type="range"
            min="0.02"
            max="12.30"
            step="0.01"
            value={search.minPrice}
            onChange={(event) => {
              const minPrice = Math.min(Number(event.currentTarget.value), search.maxPrice - 0.01)
              onUpdate((current) => ({ ...current, minPrice, page: 1 }))
            }}
            className="catalog-price-range"
          />
          <input
            aria-label="Preço máximo em ETH"
            type="range"
            min="0.02"
            max="12.30"
            step="0.01"
            value={search.maxPrice}
            onChange={(event) => {
              const maxPrice = Math.max(Number(event.currentTarget.value), search.minPrice + 0.01)
              onUpdate((current) => ({ ...current, maxPrice, page: 1 }))
            }}
            className="catalog-price-range"
          />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">Preço: {formatRangePrice(search.minPrice)} – {formatRangePrice(search.maxPrice)} ETH</p>
      </fieldset>

      <fieldset className="min-w-0 border-t border-border-soft pt-4">
        <legend className="mb-2 font-mono text-sm font-bold text-foreground">Rede</legend>
        <div className="grid gap-1">
          <FilterNetwork label="Todas as redes" value="all" search={search} onUpdate={onUpdate} />
          {nftNetworks.map((network) => <FilterNetwork key={network.id} label={network.name} value={network.id} search={search} onUpdate={onUpdate} />)}
        </div>
      </fieldset>

      <fieldset className="min-w-0 border-t border-border-soft pt-4">
        <legend className="mb-3 font-mono text-sm font-bold text-foreground">Disponibilidade</legend>
        <label className="flex min-h-9 cursor-pointer items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
          <span>Somente disponíveis</span>
          <input type="checkbox" checked={search.available} onChange={(event) => onUpdate((current) => ({ ...current, available: event.currentTarget.checked, page: 1 }))} className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        </label>
      </fieldset>

      <button type="button" onClick={onReset} className="h-9 w-fit self-end rounded-sm bg-primary px-4 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Limpar filtros</button>
    </div>
  )
}

function formatRangePrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
}

function FilterCollection({ label, value, search, onUpdate }: { label: string; value: CatalogSearch['collection']; search: CatalogSearch; onUpdate: (update: (current: CatalogSearch) => CatalogSearch) => void }) {
  const selected = search.collection === value
  return (
    <button type="button" aria-pressed={selected} onClick={() => onUpdate((current) => ({ ...current, collection: value, page: 1 }))} className={`flex min-h-8 items-center justify-between gap-2 rounded-sm px-2 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${selected ? 'bg-surface-raised text-primary' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'}`}>
      <span className="truncate">{label}</span>
      {selected && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
    </button>
  )
}

function FilterNetwork({ label, value, search, onUpdate }: { label: string; value: CatalogSearch['network']; search: CatalogSearch; onUpdate: (update: (current: CatalogSearch) => CatalogSearch) => void }) {
  const selected = search.network === value
  return (
    <label className={`flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 font-mono text-xs transition-colors ${selected ? 'bg-surface-raised text-primary' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'}`}>
      <span>{label}</span>
      <input type="radio" name="nft-network" checked={selected} onChange={() => onUpdate((current) => ({ ...current, network: value, page: 1 }))} className="size-3.5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
    </label>
  )
}

function CatalogSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFTs" className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
      {Array.from({ length: nftPageSize }, (_, index) => <NftCardSkeleton key={index} />)}
    </div>
  )
}

function PromoSection({ items }: { items: NftListItem[] }) {
  const promos = items.slice(0, 2)
  return (
    <section id="creators" aria-label="Destaques da Kurio" className="mx-auto grid max-w-300 gap-4 px-6 pb-16 md:grid-cols-2 md:px-8 lg:px-0">
      {(promos.length ? promos : [undefined, undefined]).map((nft, index) => (
        <article key={nft?.id ?? index} className="grid min-h-40 min-w-0 grid-cols-[42%_1fr] overflow-hidden rounded-sm bg-card sm:min-h-[220px]">
          <div className="relative min-h-full overflow-hidden rounded-r-lg bg-surface-raised">
            {nft && <img src={nft.imageUrl} alt="" width={420} height={420} loading="lazy" decoding="async" className="size-full object-cover" />}
          </div>
          <div className={`flex min-w-0 flex-col justify-center p-3 text-right sm:p-6 ${index === 0 ? 'text-right' : 'text-right'}`}>
            <h2 className="font-mono text-sm font-bold leading-tight text-foreground sm:text-lg">{index === 0 ? 'Lançamentos gênesis de edição limitada' : 'Arte digital selecionada e muito mais'}</h2>
            <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">{index === 0 ? 'Colecione edições escassas diretamente dos criadores antes da revelação pública.' : 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.'}</p>
            <a href="#catalog" className="mt-3 inline-flex h-8 w-fit self-end items-center rounded-sm bg-primary px-3 font-mono text-[10px] font-bold text-primary-foreground hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Explorar →</a>
          </div>
        </article>
      ))}
    </section>
  )
}

function JournalSection({ items }: { items: NftListItem[] }) {
  const articles = items.slice(0, 4)
  return (
    <section id="learn" aria-labelledby="journal-heading" className="mx-auto max-w-300 px-6 pb-16 md:px-8 md:pb-20 lg:px-0">
      <div className="mb-6 text-center md:mb-8">
        <h2 id="journal-heading" className="font-mono text-xl font-bold text-foreground sm:text-2xl">Diário da Cunhagem</h2>
        <p className="mt-2 font-mono text-xs leading-5 text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {(articles.length ? articles : Array.from({ length: 4 }, () => undefined)).map((nft, index) => (
          <article key={nft?.id ?? index} className="min-w-0 overflow-hidden rounded-sm bg-card">
            <div className="aspect-[1.1] overflow-hidden bg-surface-raised">
              {nft && <img src={nft.imageUrl} alt="" width={420} height={380} loading="lazy" decoding="async" className="size-full object-cover" />}
            </div>
            <div className="p-3">
              <p className="font-mono text-[9px] leading-4 text-secondary">{index + 12} de setembro <span aria-hidden="true">·</span> Leitura de 4 min</p>
              <h3 className="mt-1 line-clamp-2 font-mono text-xs font-bold leading-4 text-foreground">{['Como funciona a propriedade de NFTs', '10 artistas digitais para acompanhar', 'Raridade, atributos e procedência', 'Como proteger sua carteira'][index]}</h3>
              <p className="mt-1 line-clamp-3 font-mono text-[10px] leading-4 text-muted-foreground">Conheça criadores, entenda a raridade e descubra formas de explorar a cultura digital.</p>
              <a href="#catalog" className="mt-2 inline-block font-mono text-[10px] font-bold text-primary hover:underline">Ler mais →</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="mx-auto max-w-300 px-6 pb-6 md:px-8 lg:px-0">
      <div className="grid gap-6 rounded-sm bg-card p-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 lg:p-8">
        <FooterFeature icon="W" title="Segurança da carteira">Proteja sua carteira e colecione arte digital verificada com confiança.</FooterFeature>
        <FooterFeature icon="C" title="Criadores em destaque">Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.</FooterFeature>
        <FooterFeature icon="D" title="Alertas de lançamentos">Receba calendários de cunhagem, novidades e listas de acesso e análises de mercado.</FooterFeature>
        <div className="min-w-0">
          <h2 className="font-mono text-sm font-bold leading-tight">Antecipe-se ao próximo lançamento</h2>
          <form className="mt-3 flex min-w-0" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="newsletter-email">E-mail</label>
            <input id="newsletter-email" type="email" placeholder="digite seu e-mail..." className="min-w-0 flex-1 rounded-l-sm bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
            <button type="submit" className="rounded-r-sm bg-primary px-3 font-mono text-xs font-bold text-primary-foreground">Enviar</button>
          </form>
          <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </div>
      </div>
      <div className="grid gap-4 bg-surface-dark px-5 py-4 font-mono text-[10px] text-foreground sm:grid-cols-4 sm:items-center">
        <strong className="tracking-[0.12em]">KURIO</strong>
        <span className="sm:col-span-2">Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
      </div>
      <div className="grid gap-6 bg-card px-5 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <FooterLinks title="Meu perfil" links={['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse']} />
        <FooterLinks title="Central de ajuda" links={['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']} />
        <FooterLinks title="Coleções" links={['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade']} />
        <FooterLinks title="Redes sociais" links={['Instagram', 'X / Twitter', 'YouTube', 'Carteiras compatíveis']} />
      </div>
      <p className="py-4 text-center font-mono text-[10px] text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

function FooterFeature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <article className="border-b border-border-soft pb-5 last:border-0 last:pb-0 sm:border-b-0 sm:border-r sm:pr-5 lg:min-h-36">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">{icon}</span>
      <h2 className="font-mono text-sm font-bold">{title}</h2>
      <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">{children}</p>
    </article>
  )
}

function FooterLinks({ title, links }: { title: string; links: string[] }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-sm font-bold">{title}</h2>
      <ul className="grid gap-1.5 font-mono text-[10px] text-muted-foreground">
        {links.map((link) => <li key={link}><a href="#catalog" className="transition-colors hover:text-primary">{link}</a></li>)}
      </ul>
    </section>
  )
}
