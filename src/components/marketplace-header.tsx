export function MarketplaceHeader() {
  return (
    <header className="border-b border-border bg-white/90">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
        <a href="/" aria-label="Auréa, início" className="flex shrink-0 items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">A</span>
          <span className="leading-tight">
            <span className="block text-[17px] font-semibold tracking-[0.12em]">AURÉA</span>
            <span className="block text-[9px] font-medium tracking-[0.22em] text-muted-foreground">DIGITAL ART</span>
          </span>
        </a>

        <nav aria-label="Navegação principal" className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          <a href="/#catalog" className="text-foreground">Explorar</a>
          <a href="/#collections" className="transition-colors hover:text-foreground">Coleções</a>
        </nav>

        <span className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4 sm:text-sm">
          Arte digital, para sempre
        </span>
      </div>
    </header>
  )
}
