import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AuthModal } from '@/components/auth-modal'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults } from '@/lib/catalog-options'

type MarketplaceHeaderProps = {
  query?: string
  onQueryChange?: (value: string) => void
  onFiltersClick?: () => void
  filtersOpen?: boolean
  activeNav?: 'inicio' | 'mercado' | 'criadores' | 'aprenda'
  showMobileTabBar?: boolean
  showMobileHeader?: boolean
}

export function MarketplaceHeader({
  query = '',
  onQueryChange,
  onFiltersClick,
  filtersOpen = false,
  activeNav = 'inicio',
  showMobileTabBar = true,
  showMobileHeader = true,
}: MarketplaceHeaderProps) {
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [clickedNav, setClickedNav] = useState<'inicio' | 'mercado' | 'criadores' | 'aprenda' | null>(null)
  const [prevActiveNav, setPrevActiveNav] = useState(activeNav)

  if (prevActiveNav !== activeNav) {
    setPrevActiveNav(activeNav)
    setClickedNav(null)
  }

  const selectedNav = clickedNav ?? activeNav
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const { user, isAuthenticated, logout } = useAuth()
  const { totalQuantity } = useCart()
  const redirectUrl = typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/cadastro'
    ? window.location.pathname + window.location.search
    : '/'

  useEffect(() => {
    if (desktopSearchOpen) desktopSearchRef.current?.focus()
  }, [desktopSearchOpen])

  const navigate = useNavigate()

  const handleLogout = async () => {
    if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/perfil') || window.location.pathname.startsWith('/checkout') || window.location.pathname.startsWith('/pedidos'))) {
      void navigate({ to: '/', search: catalogSearchDefaults })
    }
    await logout()
  }

  const handleNavClick = (nav: 'inicio' | 'mercado' | 'criadores' | 'aprenda', targetId?: string) => {
    setClickedNav(nav)
    if (targetId) {
      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (targetId === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        void navigate({ to: '/', search: catalogSearchDefaults, hash: targetId }).then(() => {
          setTimeout(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 150)
        })
      }
    }
  }

  const isInicioActive = selectedNav === 'inicio'
  const isMercadoActive = selectedNav === 'mercado'
  const isCriadoresActive = selectedNav === 'criadores'
  const isAprendaActive = selectedNav === 'aprenda'

  return (
    <>
      <header id="top" className="hidden border-b border-border-soft md:block">
        <div className="relative mx-auto flex h-19 max-w-300 items-center justify-between gap-6 px-6 lg:px-0">
          <Link
            to="/"
            search={catalogSearchDefaults}
            aria-label="Kurio, início"
            onClick={() => handleNavClick('inicio', 'top')}
            className="shrink-0 font-mono text-sm font-bold tracking-[0.12em] text-foreground"
          >
            KURIO
          </Link>

          <nav aria-label="Navegação principal" className="flex h-full items-center gap-8 font-mono text-sm font-medium text-[#F5F1EB]">
            <Link
              to="/"
              search={catalogSearchDefaults}
              aria-current={isInicioActive ? 'page' : undefined}
              onClick={() => handleNavClick('inicio', 'top')}
              className={`relative flex h-full items-center transition-colors hover:text-foreground ${
                isInicioActive ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : ''
              }`}
            >
              Início
            </Link>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchDefaults}
              aria-current={isMercadoActive ? 'page' : undefined}
              onClick={() => handleNavClick('mercado', 'catalog')}
              className={`relative flex h-full items-center transition-colors hover:text-foreground ${
                isMercadoActive ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : ''
              }`}
            >
              Mercado
            </Link>
            <Link
              to="/"
              hash="creators"
              search={catalogSearchDefaults}
              aria-current={isCriadoresActive ? 'page' : undefined}
              onClick={() => handleNavClick('criadores', 'creators')}
              className={`relative flex h-full items-center transition-colors hover:text-foreground ${
                isCriadoresActive ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : ''
              }`}
            >
              Criadores
            </Link>
            <Link
              to="/"
              hash="learn"
              search={catalogSearchDefaults}
              aria-current={isAprendaActive ? 'page' : undefined}
              onClick={() => handleNavClick('aprenda', 'learn')}
              className={`relative flex h-full items-center transition-colors hover:text-foreground ${
                isAprendaActive ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : ''
              }`}
            >
              Aprenda
            </Link>
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
            <Link
              to="/carrinho"
              aria-label={`Carrinho, ${totalQuantity} ${totalQuantity === 1 ? 'item' : 'itens'}`}
              className="relative grid size-8 place-items-center rounded-md transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <CartIcon className="size-5" />
              {totalQuantity > 0 && (
                <span
                  data-testid="cart-badge-count"
                  className="absolute right-0 top-0 grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground"
                >
                  {totalQuantity > 99 ? '99+' : totalQuantity}
                </span>
              )}
            </Link>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/perfil"
                  className="inline-flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-surface-raised"
                  aria-label="Ir para o perfil do colecionador"
                >
                  <span className="font-mono text-xs font-semibold text-foreground sm:text-sm hover:text-primary transition-colors" data-testid="user-name">
                    {user.name}
                  </span>
                </Link>
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
                onClick={(e) => {
                  e.preventDefault()
                  setAuthModalOpen(true)
                }}
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

      {showMobileHeader && (
        <header className="px-6 pb-0 pt-10 md:hidden">
          {isAuthenticated && user && (
            <div className="mx-auto mb-3 flex max-w-120 items-center justify-between border-b border-border/40 pb-2 font-mono text-xs text-muted-foreground">
              <Link to="/perfil" className="hover:text-primary transition-colors">
                <span>Olá, <strong className="text-foreground">{user.name}</strong></span>
              </Link>
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
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {showMobileTabBar && <MobileTabBar />}
    </>
  )
}

function MobileTabBar() {
  const { user, isAuthenticated } = useAuth()
  const { totalQuantity } = useCart()
  const redirectUrl = typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/cadastro'
    ? window.location.pathname + window.location.search
    : '/'

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-50 h-19 pb-[env(safe-area-inset-bottom)] md:hidden select-none"
    >
      {/* Background layer with concave center scoop notch and shadow */}
      <div
        className="absolute inset-0 flex h-full w-full pointer-events-none"
        style={{ filter: 'drop-shadow(0 -8px 24px rgba(20, 13, 10, 0.45))' }}
      >
        <div className="flex-1 h-full bg-card rounded-tl-[36px] -mr-px" />
        <svg
          viewBox="0 0 120 76"
          className="w-30 h-19 shrink-0 fill-card"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0,0 L 12,0 C 20,0 26,6 29,16 C 33,36 44,48 60,48 C 76,48 87,36 91,16 C 94,6 100,0 108,0 L 120,0 L 120,76 L 0,76 Z" />
        </svg>
        <div className="flex-1 h-full bg-card rounded-tr-[36px] -ml-px" />
      </div>

      {/* Atmospheric radial glow behind the floating button and scoop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-10 -translate-x-1/2 h-28 w-32 rounded-full bg-[radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.6)_0%,rgba(240,163,99,0.3)_35%,transparent_70%)] blur-lg -z-10"
      />

      {/* Interactive 5-column navigation */}
      <div className="relative grid h-full grid-cols-5 items-center px-4 text-secondary">
        <Link
          to="/"
          hash="top"
          search={catalogSearchDefaults}
          aria-label="Início"
          className="grid h-full place-items-center text-primary"
        >
          <HomeIcon className="size-5" />
        </Link>

        {isAuthenticated ? (
          <Link
            to="/perfil"
            search={{ tab: 'favoritos' }}
            aria-label="Favoritos"
            className="grid h-full place-items-center text-secondary hover:text-primary"
          >
            <HeartIcon className="size-5" />
          </Link>
        ) : (
          <Link
            to="/login"
            search={{ redirect: '/perfil?tab=favoritos' }}
            aria-label="Favoritos"
            className="grid h-full place-items-center text-secondary hover:text-primary"
          >
            <HeartIcon className="size-5" />
          </Link>
        )}

        {/* Center Floating Catalog Button nestled in the notch */}
        <div className="relative grid h-full place-items-center">
          <Link
            to="/"
            hash="catalog"
            search={catalogSearchDefaults}
            aria-label="Explorar NFTs"
            className="absolute -top-4.5 grid size-14 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_35%,#F0A363_0%,#D88344_55%,#BD6C2E_100%)] text-white shadow-[0_12px_24px_rgba(216,131,68,0.45)] ring-1 ring-white/20 transition-transform active:scale-95"
          >
            <ScanIcon className="size-6" />
          </Link>
        </div>

        <Link
          to="/carrinho"
          aria-label={`Carrinho, ${totalQuantity} itens`}
          className="relative grid h-full place-items-center text-secondary hover:text-primary"
        >
          <CartIcon className="size-5" />
          {totalQuantity > 0 && (
            <span className="absolute right-3.5 top-3.5 grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground">
              {totalQuantity > 99 ? '99+' : totalQuantity}
            </span>
          )}
        </Link>

        {isAuthenticated ? (
          <Link
            to="/perfil"
            aria-label={`Perfil de ${user?.name ?? 'usuário'}`}
            className="grid h-full place-items-center text-secondary hover:text-primary"
          >
            <UserIcon className="size-5" />
          </Link>
        ) : (
          <Link
            to="/login"
            search={{ redirect: redirectUrl }}
            aria-label="Entrar na conta"
            className="grid h-full place-items-center text-secondary hover:text-primary"
          >
            <UserIcon className="size-5" />
          </Link>
        )}
      </div>
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
