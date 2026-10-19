export type HealthResponse = {
  status: 'ok'
  service: string
  checkedAt: string
}

export type NftUpdatedEvent = {
  nftId: string
  priceEth: string
  available: number
  version: number
}
