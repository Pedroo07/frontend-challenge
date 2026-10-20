import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { HeartIcon } from '@/components/marketplace-header'
import { useCart } from '@/lib/cart-context'
import { formatEth } from '@/lib/catalog-options'
import { useFavorites } from '@/lib/favorites'
import type { NftListItem } from '@/mocks/contracts'

export function NftCard({ nft, priority = false }: { nft: NftListItem; priority?: boolean }) {
  const { isFavorite, toggleFavorite, isPending, pendingNftId } = useFavorites()
  const { addItem, isMutating } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const favorite = isFavorite(nft.id)
  const isToggling = isPending && pendingNftId === nft.id
  const edition = nft.name.match(/#\s*([\w-]+)/)?.[1] ?? nft.id.split('-').at(-1) ?? '01'

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const targetEdition = nft.editions.find((ed) => ed.available > 0) ?? nft.editions[0]
    if (!targetEdition || targetEdition.available <= 0) return
    try {
      await addItem({ nftId: nft.id, editionId: targetEdition.id, quantity: 1 })
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 2000)
    } catch  {
      void 0
    }
  }

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-sm bg-card transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,0,0,0.28)] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-primary">
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        aria-label={`Ver detalhes de ${nft.name}`}
        className="block min-w-0 focus-visible:outline-none"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-raised">
          <img
            src={nft.imageUrl}
            alt={`${nft.name}, obra da coleção ${nft.collection.name}`}
            width={640}
            height={640}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            sizes="(max-width: 767px) calc((100vw - 56px) / 2), (max-width: 1279px) 34vw, 260px"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          />
          {nft.available === 1 && <span className="absolute left-0 top-0 rounded-br-md bg-primary px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-primary-foreground">Raro</span>}
          {nft.available === 0 && <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-muted-foreground">Esgotado</span>}
        </div>
        <div className="px-2.5 pb-0 pt-2 sm:px-3">
          <h3 className="truncate font-mono text-xs font-semibold leading-5 text-foreground sm:text-sm">{nft.name}</h3>
          <p className="truncate font-mono text-[10px] leading-4 text-muted-foreground">{nft.collection.name} <span aria-hidden="true">·</span> Edição #{edition}</p>
        </div>
      </Link>

      <button
        type="button"
        aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`}
        aria-pressed={favorite}
        disabled={isToggling}
        onClick={() => void toggleFavorite(nft)}
        className={`absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full border border-border bg-card/95 shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${favorite ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <HeartIcon className="size-4" filled={favorite} />
      </button>

      <div className="flex min-w-0 items-center justify-between gap-1 px-2.5 pb-2.5 pt-1 sm:px-3 sm:pb-3">
        <p className="truncate font-mono text-xs font-bold tracking-wide text-primary sm:text-sm">{formatEth(nft.priceEth)} ETH</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={nft.available === 0 || isMutating}
            onClick={(e) => void handleQuickAdd(e)}
            aria-label={
              nft.available === 0
                ? `${nft.name} esgotado`
                : justAdded
                  ? `${nft.name} adicionado ao carrinho`
                  : `Adicionar ${nft.name} ao carrinho`
            }
            className={`grid size-8 place-items-center rounded-full text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${justAdded ? 'bg-success text-white' : 'bg-primary hover:bg-primary-light'}`}
          >
            {justAdded ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            ) : (
              <CartIcon className="size-4" />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-sm bg-card">
      <div className="aspect-square w-full animate-shimmer rounded-lg" />
      <div className="space-y-2 px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
        <div className="h-3.5 w-3/4 animate-shimmer rounded-sm" />
        <div className="h-2.5 w-1/2 animate-shimmer rounded-sm" />
        <div className="h-3 w-1/3 animate-shimmer rounded-sm" />
      </div>
    </div>
  )
}

function CartIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}><path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.3" fill="currentColor" /><circle cx="18" cy="20" r="1.3" fill="currentColor" /></svg>
}
