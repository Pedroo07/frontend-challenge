import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent } from './contracts'

const socketOrigin = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
const socketLink = ws.link(socketOrigin)

const nftUpdate: NftUpdatedEvent = {
  nftId: 'nft-aurora-017',
  priceEth: '1.275',
  available: 4,
  version: 2,
}

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const { client } = toSocketIo(connection)
    const timeoutId = window.setTimeout(() => {
      client.emit('nft.updated', nftUpdate)
    }, 100)

    connection.client.addEventListener('close', () => window.clearTimeout(timeoutId), { once: true })
  }),
]
