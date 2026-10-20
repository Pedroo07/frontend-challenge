import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent } from './contracts'

const socketOrigin = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
const socketLink = ws.link(socketOrigin)

const nftUpdate: NftUpdatedEvent = {
  nftId: 'nft-aurora-017',
  priceEth: '1.275',
  available: 4,
  version: 2,
}

type SocketClient = ReturnType<typeof toSocketIo>['client']
const activeClients = new Set<SocketClient>()

export function emitNftUpdateToClients(event: NftUpdatedEvent) {
  for (const client of activeClients) {
    try {
      client.emit('nft.updated', event)
    } catch  {
      void 0
    }
  }
}

export function emitOrderUpdateToClients(event: OrderUpdatedEvent) {
  for (const client of activeClients) {
    try {
      client.emit('order.updated', event)
    } catch  {
      void 0
    }
  }
}

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const { client } = toSocketIo(connection)
    activeClients.add(client)

    const timeoutId = window.setTimeout(() => {
      client.emit('nft.updated', nftUpdate)
    }, 100)

    connection.client.addEventListener('close', () => {
      window.clearTimeout(timeoutId)
      activeClients.delete(client)
    }, { once: true })
  }),
]
