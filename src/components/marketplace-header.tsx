import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

type MarketplaceHeaderProps = {
  query?: string
  onQueryChange?: (value: string) => void
  onFiltersClick?: () => void
  filtersOpen?: boolean
}

export function MarketplaceHeader({ query = '', onQueryChange, onFiltersClick, filtersOpen = false }: MarketplaceHeaderProps) {
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const { user, isAuthenticated, logout } = useAuth()

  useEffect(() => {
    if (desktopSearchOpen) desktopSearchRef.current?.focus()
  }, [desktopSearchOpen])

  const redirectUrl = typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/cadastro'
    ? window.location.pathname + window.location.search
    : '/'

  const handleLogout = async () => {
    await logout()
  }

  return (
    <>
      <header id="top" className="hidden border-b border-border-soft md:block">
        <div className="relative mx-auto flex h-[76px] max-w-300 items-center justify-between gap-6 px-6 lg:px-0">
          <a href="#top" aria-label="Kurio, início" className="shrink-0 font-mono text-sm font-bold tracking-[0.12em] text-foreground">
            KURIO
          </a>

          <nav aria-label="Navegação principal" className="flex h-full items-center gap-8 font-mono text-sm font-medium text-muted-foreground">
            <a href="#top" aria-current="page" className="relative flex h-full items-center text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary">Início</a>
            <a href="#catalog" className="transition-colors hover:text-foreground">Mercado</a>
            <a href="#creators" className="transition-colors hover:text-foreground">Criadores</a>
            <a href="#learn" className="transition-colors hover:text-foreground">Aprenda</a>
          </nav>

          <div className="flex shrink-0 items-center gap-5 text-muted-foreground">
            <button
              type="button"
              aria-label="Buscar no catálogo"
              aria-expanded={desktopSearchOpen}
              onClick={() => setDesktopSearchOpen((open) => !open)}
              className="grid size-8 place-items-center rounded-md transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <SearchIcon className="size-5" />
            </button>
            <a href="#catalog" aria-label="Carrinho, 0 itens" className="relative grid size-8 place-items-center rounded-md transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <CartIcon className="size-5" />
              <span className="absolute right-0 top-0 grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground">0</span>
            </a>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-foreground sm:text-sm" data-testid="user-name">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="Sair da conta"
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                search={{ redirect: redirectUrl }}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <UserIcon className="size-4" /> Entrar
              </Link>
            )}
          </div>

          {desktopSearchOpen && onQueryChange && (
            <form role="search" onSubmit={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }} className="absolute right-20 top-[calc(100%-4px)] z-40 w-[min(360px,calc(100vw-48px))] rounded-lg border border-border bg-card p-3 shadow-xl">
              <label className="sr-only" htmlFor="desktop-catalog-search">Buscar NFTs</label>
              <input
                ref={desktopSearchRef}
                id="desktop-catalog-search"
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder="Buscar coleções e NFTs"
                className="h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </form>
          )}
        </div>
      </header>

      <header className="px-6 pb-0 pt-10 md:hidden">
        {isAuthenticated && user && (
          <div className="mx-auto mb-3 flex max-w-120 items-center justify-between border-b border-border/40 pb-2 font-mono text-xs text-muted-foreground">
            <span>Olá, <strong className="text-foreground">{user.name}</strong></span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sair da conta"
              className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              Sair
            </button>
          </div>
        )}

        <div className="mx-auto flex max-w-120 items-center gap-2">
          <form role="search" onSubmit={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }} className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="mobile-catalog-search">Explorar coleções</label>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-secondary" />
            <input
              id="mobile-catalog-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => onQueryChange?.(event.currentTarget.value)}
              placeholder="Explorar coleções"
              className="h-12 w-full min-w-0 rounded-lg border border-transparent bg-card px-11 font-mono text-sm text-foreground outline-none placeholder:font-semibold placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </form>
          {onFiltersClick && <button
            type="button"
            aria-label={filtersOpen ? 'Fechar filtros' : 'Abrir filtros'}
            aria-controls="mobile-catalog-filters"
            aria-expanded={filtersOpen}
            onClick={onFiltersClick}
            className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <FilterIcon className="size-5" />
          </button>}
        </div>
      </header>

      <MobileTabBar />
    </>
  )
}

function MobileTabBar() {
  const { user, isAuthenticated, logout } = useAuth()
  const redirectUrl = typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/cadastro'
    ? window.location.pathname + window.location.search
    : '/'

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-50 grid h-[76px] grid-cols-5 items-center rounded-t-mobile-nav bg-card px-5 pb-[env(safe-area-inset-bottom)] text-secondary shadow-[0_-8px_32px_rgba(20,13,10,0.36)] md:hidden">
      <a href="#top" aria-label="Início" className="grid h-full place-items-center text-primary"><HomeIcon className="size-5" /></a>
      {isAuthenticated ? (
        <a href="#catalog" aria-label="Favoritos" className="grid h-full place-items-center"><HeartIcon className="size-5" /></a>
      ) : (
        <Link to="/login" search={{ redirect: redirectUrl }} aria-label="Favoritos" className="grid h-full place-items-center"><HeartIcon className="size-5" /></Link>
      )}
      <a href="#catalog" aria-label="Explorar NFTs" className="-mt-6 grid size-14 place-self-center place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg"><ScanIcon className="size-6" /></a>
      <a href="#catalog" aria-label="Carrinho" className="grid h-full place-items-center"><CartIcon className="size-5" /></a>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => void logout()}
          aria-label={`Sair da conta de ${user?.name ?? 'usuário'}`}
          className="grid h-full place-items-center text-muted-foreground hover:text-destructive"
        >
          <UserIcon className="size-5 text-primary" />
        </button>
      ) : (
        <Link
          to="/login"
          search={{ redirect: redirectUrl }}
          aria-label="Entrar na conta"
          className="grid h-full place-items-center text-muted-foreground hover:text-primary"
        >
          <UserIcon className="size-5" />
        </Link>
      )}
    </nav>
  )
}

export function SearchIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}

export function FilterIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}><path d="M4 6h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="15" cy="18" r="2" fill="currentColor" /><path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="14" cy="12" r="2" fill="currentColor" /></svg>
}

export function HeartIcon({ className = 'size-5', filled = true }: { className?: string; filled?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} className={className}><path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.5 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
}

function CartIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.3" fill="currentColor" /><circle cx="18" cy="20" r="1.3" fill="currentColor" /></svg>
}

function UserIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0v1h-15v-1Z" /></svg>
}

function HomeIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg>
}

function ScanIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
