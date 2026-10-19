import type { Nft, NftEdition, NftListItem } from '../contracts'

type FixtureInput = Omit<Nft, 'editions' | 'version'> & {
  priceEth: string
  available: number
  editionPriceEth?: string
  editionAvailable?: number
}

function makeNft(input: FixtureInput): Nft {
  const { priceEth, available, editionPriceEth, editionAvailable = 0, ...nft } = input
  const editionSuffix = nft.id.split('-').at(-1) ?? '01'
  const editions: NftEdition[] = [
    {
      id: 'open',
      name: 'Edição aberta',
      editionNumber: editionSuffix,
      supply: 100,
      priceEth,
      available,
    },
    {
      id: 'artist-proof',
      name: 'Prova de artista',
      editionNumber: '01',
      supply: 1,
      priceEth: editionPriceEth ?? `${(Number(priceEth) * 2).toFixed(3)}`,
      available: editionAvailable,
    },
  ]

  return { ...nft, editions, version: nft.id === 'nft-aurora-017' ? 2 : 1 }
}

export const nftFixtures: Nft[] = [
  makeNft({
    id: 'nft-aurora-017',
    name: 'Aurora #017',
    collection: { id: 'aurora', name: 'Aurora' },
    creator: 'Lena Volkov',
    description: 'Luzes que atravessam o horizonte em uma paisagem feita de cor, silêncio e movimento.',
    imageUrl: '/nfts/aurora.svg',
    createdAt: '2026-10-18T12:00:00.000Z',
    priceEth: '1.275',
    editionPriceEth: '3.900',
    available: 4,
  }),
  makeNft({
    id: 'nft-flora-006',
    name: 'Petal Study #06',
    collection: { id: 'flora', name: 'Forma Flora' },
    creator: 'Mina Park',
    description: 'Uma composição botânica digital sobre formas orgânicas e a passagem da luz.',
    imageUrl: '/nfts/flora.svg',
    createdAt: '2026-10-16T12:00:00.000Z',
    priceEth: '0.84',
    available: 7,
  }),
  makeNft({
    id: 'nft-afterlight-022',
    name: 'Afterlight #022',
    collection: { id: 'afterlight', name: 'Afterlight' },
    creator: 'Noah Chen',
    description: 'Um último brilho no céu azul, registrado como uma edição digital colecionável.',
    imageUrl: '/nfts/afterlight.svg',
    createdAt: '2026-10-14T12:00:00.000Z',
    priceEth: '2.15',
    available: 2,
    editionPriceEth: '4.300',
    editionAvailable: 1,
  }),
  makeNft({
    id: 'nft-aurora-016',
    name: 'Aurora #016',
    collection: { id: 'aurora', name: 'Aurora' },
    creator: 'Lena Volkov',
    description: 'Uma forma luminosa suspensa sobre uma paisagem violeta.',
    imageUrl: '/nfts/aurora.svg',
    createdAt: '2026-10-12T12:00:00.000Z',
    priceEth: '0.95',
    available: 8,
  }),
  makeNft({
    id: 'nft-flora-004',
    name: 'Petal Study #04',
    collection: { id: 'flora', name: 'Forma Flora' },
    creator: 'Mina Park',
    description: 'Pétalas geométricas em uma paleta de coral, rosa e creme.',
    imageUrl: '/nfts/flora.svg',
    createdAt: '2026-10-10T12:00:00.000Z',
    priceEth: '0.62',
    available: 0,
  }),
  makeNft({
    id: 'nft-afterlight-019',
    name: 'Afterlight #019',
    collection: { id: 'afterlight', name: 'Afterlight' },
    creator: 'Noah Chen',
    description: 'Camadas de luz azul e violeta inspiradas no céu depois do pôr do sol.',
    imageUrl: '/nfts/afterlight.svg',
    createdAt: '2026-10-08T12:00:00.000Z',
    priceEth: '1.65',
    available: 3,
  }),
  makeNft({
    id: 'nft-aurora-013',
    name: 'Aurora #013',
    collection: { id: 'aurora', name: 'Aurora' },
    creator: 'Lena Volkov',
    description: 'Ondas suaves de cor lembram uma aurora em noite fria.',
    imageUrl: '/nfts/aurora.svg',
    createdAt: '2026-10-06T12:00:00.000Z',
    priceEth: '0.55',
    available: 1,
  }),
  makeNft({
    id: 'nft-flora-002',
    name: 'Petal Study #02',
    collection: { id: 'flora', name: 'Forma Flora' },
    creator: 'Mina Park',
    description: 'Um estudo digital de flores em tons quentes e formas circulares.',
    imageUrl: '/nfts/flora.svg',
    createdAt: '2026-10-04T12:00:00.000Z',
    priceEth: '1.1',
    available: 5,
  }),
  makeNft({
    id: 'nft-afterlight-012',
    name: 'Afterlight #012',
    collection: { id: 'afterlight', name: 'Afterlight' },
    creator: 'Noah Chen',
    description: 'Horizonte em tons frios com uma pequena estrela em destaque.',
    imageUrl: '/nfts/afterlight.svg',
    createdAt: '2026-10-02T12:00:00.000Z',
    priceEth: '0.74',
    available: 0,
  }),
  makeNft({
    id: 'nft-aurora-009',
    name: 'Aurora #009',
    collection: { id: 'aurora', name: 'Aurora' },
    creator: 'Lena Volkov',
    description: 'Uma variação mínima da série Aurora em azul e violeta.',
    imageUrl: '/nfts/aurora.svg',
    createdAt: '2026-09-30T12:00:00.000Z',
    priceEth: '2.8',
    available: 2,
  }),
  makeNft({
    id: 'nft-flora-001',
    name: 'Petal Study #01',
    collection: { id: 'flora', name: 'Forma Flora' },
    creator: 'Mina Park',
    description: 'A peça inaugural de uma série de estudos botânicos digitais.',
    imageUrl: '/nfts/flora.svg',
    createdAt: '2026-09-28T12:00:00.000Z',
    priceEth: '3.2',
    available: 1,
  }),
  makeNft({
    id: 'nft-afterlight-003',
    name: 'Afterlight #003',
    collection: { id: 'afterlight', name: 'Afterlight' },
    creator: 'Noah Chen',
    description: 'Uma peça serena da coleção Afterlight, com gradientes noturnos.',
    imageUrl: '/nfts/afterlight.svg',
    createdAt: '2026-09-26T12:00:00.000Z',
    priceEth: '0.48',
    available: 0,
  }),
]

export function summarizeNft(nft: Nft): NftListItem {
  const pricedEditions = [...nft.editions].sort((a, b) => Number(a.priceEth) - Number(b.priceEth))
  const availableEditions = pricedEditions.filter((edition) => edition.available > 0)
  const lowestEdition = availableEditions[0] ?? pricedEditions[0]

  return {
    ...nft,
    priceEth: lowestEdition?.priceEth ?? '0',
    available: nft.editions.reduce((total, edition) => total + edition.available, 0),
    availableEditionCount: availableEditions.length,
  }
}
