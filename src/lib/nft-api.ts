import { http } from '@/lib/http'
import { nftPageSize, type CatalogSearch } from '@/lib/catalog-options'
import type { Nft, NftListResponse } from '@/mocks/contracts'

export function getNftList(search: CatalogSearch, signal: AbortSignal) {
  return http.get<NftListResponse>('/api/nfts', {
    signal,
    params: {
      q: search.q || undefined,
      collection: search.collection === 'all' ? undefined : search.collection,
      available: search.available || undefined,
      sort: search.sort,
      minPrice: search.minPrice,
      maxPrice: search.maxPrice,
      network: search.network === 'all' ? undefined : search.network,
      page: search.page,
      pageSize: nftPageSize,
    },
  }).then((response) => response.data)
}

export function getNft(nftId: string, signal: AbortSignal) {
  return http.get<Nft>(`/api/nfts/${encodeURIComponent(nftId)}`, { signal }).then((response) => response.data)
}
