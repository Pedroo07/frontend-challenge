import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { http } from '@/lib/http'
import type { HealthResponse, NftUpdatedEvent } from '@/mocks/contracts'

export const Route = createFileRoute('/diagnostic')({ component: DiagnosticPage })

function DiagnosticPage() {
  const { mocks } = Route.useRouteContext()
  const [socketStatus, setSocketStatus] = useState('Conectando')
  const [lastUpdate, setLastUpdate] = useState<NftUpdatedEvent | null>(null)
  const health = useQuery({
    queryKey: ['diagnostic', 'health'],
    queryFn: async () => (await http.get<HealthResponse>('/api/health')).data,
  })

  useEffect(() => {
    const socket: Socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
      timeout: 5_000,
    })

    const handleConnect = () => setSocketStatus('Conectado')
    const handleDisconnect = (reason: string) => setSocketStatus(`Desconectado (${reason})`)
    const handleError = (error: Error) => setSocketStatus(`Erro: ${error.message}`)
    const handleUpdate = (event: NftUpdatedEvent) => setLastUpdate(event)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleError)
    socket.on('nft.updated', handleUpdate)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleError)
      socket.off('nft.updated', handleUpdate)
      socket.disconnect()
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">NFT Marketplace · Fundação</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Diagnóstico de integrações</h1>
        <p className="max-w-2xl text-muted-foreground">
          Verificação temporária das integrações simuladas de REST e Socket.IO no navegador.
        </p>
      </header>

      <section aria-label="Estado das integrações" className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inicialização do MSW</CardTitle>
            <CardDescription>Service Worker responsável pelos mocks de rede.</CardDescription>
          </CardHeader>
          <CardContent>
            <p role="status" aria-live="polite" data-testid="msw-status" className="font-medium">
              {mocks === 'ready' ? 'Pronto · interceptação ativa' : `Estado: ${mocks}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consulta REST</CardTitle>
            <CardDescription>GET /api/health via TanStack Query e Axios.</CardDescription>
          </CardHeader>
          <CardContent>
            {health.isPending && <p role="status">Consultando API…</p>}
            {health.isError && <p role="alert">Falha na consulta: {health.error.message}</p>}
            {health.isSuccess && (
              <dl className="grid gap-2 text-sm" data-testid="rest-result">
                <div className="flex gap-2"><dt className="font-medium">Estado</dt><dd>{health.data.status}</dd></div>
                <div className="flex gap-2"><dt className="font-medium">Serviço</dt><dd>{health.data.service}</dd></div>
                <div className="flex flex-wrap gap-2"><dt className="font-medium">Verificado em</dt><dd>{health.data.checkedAt}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conexão Socket.IO</CardTitle>
            <CardDescription>Cliente com transporte WebSocket forçado.</CardDescription>
          </CardHeader>
          <CardContent>
            <p role="status" aria-live="polite" data-testid="socket-status" className="font-medium">{socketStatus}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Último evento nft.updated</CardTitle>
            <CardDescription>Payload recebido pelo socket.io-client.</CardDescription>
          </CardHeader>
          <CardContent>
            {lastUpdate ? (
              <dl className="grid gap-2 text-sm" data-testid="nft-update">
                <div className="flex gap-2"><dt className="font-medium">NFT</dt><dd>{lastUpdate.nftId}</dd></div>
                <div className="flex gap-2"><dt className="font-medium">Preço</dt><dd>{lastUpdate.priceEth} ETH</dd></div>
                <div className="flex gap-2"><dt className="font-medium">Disponível</dt><dd>{lastUpdate.available}</dd></div>
                <div className="flex gap-2"><dt className="font-medium">Versão</dt><dd>{lastUpdate.version}</dd></div>
              </dl>
            ) : (
              <p role="status">Aguardando evento…</p>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-sm text-muted-foreground">Esta tela temporária pode ser acessada em /diagnostic.</p>
    </main>
  )
}
