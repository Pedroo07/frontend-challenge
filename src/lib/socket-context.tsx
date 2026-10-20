import { useQueryClient } from '@tanstack/react-query'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { triggerMockNftUpdate } from './cart-api'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/mocks/contracts'

type SocketContextValue = {
  socket: Socket | null
  isConnected: boolean
  socketStatus: string
  lastUpdate: NftUpdatedEvent | null
  lastOrderUpdate: OrderUpdatedEvent | null
  updatedNfts: Record<string, NftUpdatedEvent>
  clearUpdatedNotice: (nftId: string) => void
  triggerDemoUpdate: (payload: {
    nftId: string
    priceEth?: string
    available?: number
    editionId?: string
    version?: number
  }) => Promise<void>
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [socketStatus, setSocketStatus] = useState('Conectando')
  const [lastUpdate, setLastUpdate] = useState<NftUpdatedEvent | null>(null)
  const [lastOrderUpdate, setLastOrderUpdate] = useState<OrderUpdatedEvent | null>(null)
  const [updatedNfts, setUpdatedNfts] = useState<Record<string, NftUpdatedEvent>>({})

  const lastVersionsRef = useRef<Map<string, number>>(new Map())
  const orderVersionsRef = useRef<Map<string, number>>(new Map())
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.location.pathname.startsWith('/diagnostic')) return

    const socket: Socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 5000,
    })
    socketRef.current = socket
    queueMicrotask(() => {
      setSocketInstance(socket)
    })

    let hasConnectedOnce = false

    const handleConnect = () => {
      setIsConnected(true)
      setSocketStatus('Conectado')
      if (hasConnectedOnce) {

        void queryClient.invalidateQueries({ queryKey: ['nfts'] })
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
        void queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] })
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      } else {
        hasConnectedOnce = true
      }
    }

    const handleDisconnect = (reason: string) => {
      setIsConnected(false)
      setSocketStatus(`Desconectado (${reason})`)
    }

    const handleConnectError = (error: Error) => {
      setIsConnected(false)
      setSocketStatus(`Erro: ${error.message}`)
    }

    const handleNftUpdate = (event: NftUpdatedEvent) => {
      if (!event || !event.nftId) return


      const lastVersion = lastVersionsRef.current.get(event.nftId) ?? 0
      if (event.version <= lastVersion) {
        return
      }
      lastVersionsRef.current.set(event.nftId, event.version)

      setLastUpdate(event)
      setUpdatedNfts((prev) => ({ ...prev, [event.nftId]: event }))


      void queryClient.invalidateQueries({ queryKey: ['nfts', 'detail', event.nftId] })
      void queryClient.invalidateQueries({ queryKey: ['nfts'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] })
    }

    const handleOrderUpdate = (event: OrderUpdatedEvent) => {
      if (!event || !event.orderId) return


      const lastVersion = orderVersionsRef.current.get(event.orderId) ?? 0
      if (event.version <= lastVersion) {
        return
      }
      orderVersionsRef.current.set(event.orderId, event.version)

      setLastOrderUpdate(event)


      void queryClient.invalidateQueries({ queryKey: ['orders', event.orderId] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] })
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('nft.updated', handleNftUpdate)
    socket.on('order.updated', handleOrderUpdate)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('nft.updated', handleNftUpdate)
      socket.off('order.updated', handleOrderUpdate)
      socket.disconnect()
      socketRef.current = null
      setSocketInstance(null)
    }
  }, [queryClient])

  const clearUpdatedNotice = useCallback((nftId: string) => {
    setUpdatedNfts((prev) => {
      const next = { ...prev }
      delete next[nftId]
      return next
    })
  }, [])

  const triggerDemoUpdate = useCallback(async (payload: {
    nftId: string
    priceEth?: string
    available?: number
    editionId?: string
    version?: number
  }) => {
    await triggerMockNftUpdate(payload)
  }, [])

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketInstance,
      isConnected,
      socketStatus,
      lastUpdate,
      lastOrderUpdate,
      updatedNfts,
      clearUpdatedNotice,
      triggerDemoUpdate,
    }),
    [socketInstance, isConnected, socketStatus, lastUpdate, lastOrderUpdate, updatedNfts, clearUpdatedNotice, triggerDemoUpdate],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket deve ser utilizado dentro de um SocketProvider.')
  }
  return context
}


// eslint-disable-next-line react-refresh/only-export-components
export function useNftSocket(
  nftId: string,
  onUpdate?: (event: NftUpdatedEvent) => void,
) {
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  const lastVersionRef = useRef<number>(0)
  const processedEventIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!socket || !nftId) return

    const handleUpdate = (event: NftUpdatedEvent & { eventId?: string }) => {
      if (!event || event.nftId !== nftId) return


      if (event.eventId) {
        if (processedEventIdsRef.current.has(event.eventId)) {
          return
        }
        processedEventIdsRef.current.add(event.eventId)
      }


      if (typeof event.version === 'number') {
        if (event.version <= lastVersionRef.current) {
          return
        }
        lastVersionRef.current = event.version
      }


      void queryClient.invalidateQueries({ queryKey: ['nfts', 'detail', nftId] })
      onUpdate?.(event)
    }

    socket.on('nft.updated', handleUpdate)

    return () => {
      socket.off('nft.updated', handleUpdate)
    }
  }, [socket, nftId, queryClient, onUpdate])
}
