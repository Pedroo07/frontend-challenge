import { useQueryClient } from '@tanstack/react-query'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { triggerMockNftUpdate } from './cart-api'
import type { NftUpdatedEvent } from '@/mocks/contracts'

type SocketContextValue = {
  isConnected: boolean
  socketStatus: string
  lastUpdate: NftUpdatedEvent | null
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
  const [isConnected, setIsConnected] = useState(false)
  const [socketStatus, setSocketStatus] = useState('Conectando')
  const [lastUpdate, setLastUpdate] = useState<NftUpdatedEvent | null>(null)
  const [updatedNfts, setUpdatedNfts] = useState<Record<string, NftUpdatedEvent>>({})

  const lastVersionsRef = useRef<Map<string, number>>(new Map())
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // A página /diagnostic testa sua própria conexão isolada de Socket.IO
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

    let hasConnectedOnce = false

    const handleConnect = () => {
      setIsConnected(true)
      setSocketStatus('Conectado')
      if (hasConnectedOnce) {
        // Na reconexão, recupera o estado atualizado pela API REST
        void queryClient.invalidateQueries({ queryKey: ['nfts'] })
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
        void queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] })
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

      // Validação de versão monotônica: ignora versões menores ou iguais à última vista
      const lastVersion = lastVersionsRef.current.get(event.nftId) ?? 0
      if (event.version <= lastVersion) {
        return
      }
      lastVersionsRef.current.set(event.nftId, event.version)

      setLastUpdate(event)
      setUpdatedNfts((prev) => ({ ...prev, [event.nftId]: event }))

      // Atualiza ou invalida os dados de consulta afetados
      void queryClient.invalidateQueries({ queryKey: ['nfts', 'detail', event.nftId] })
      void queryClient.invalidateQueries({ queryKey: ['nfts'] })
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['cart', 'quote'] })
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('nft.updated', handleNftUpdate)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('nft.updated', handleNftUpdate)
      socket.disconnect()
      socketRef.current = null
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
      isConnected,
      socketStatus,
      lastUpdate,
      updatedNfts,
      clearUpdatedNotice,
      triggerDemoUpdate,
    }),
    [isConnected, socketStatus, lastUpdate, updatedNfts, clearUpdatedNotice, triggerDemoUpdate],
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
