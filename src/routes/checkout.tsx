import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { useEffect, useId, useRef, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { formatEthDisplay } from '@/lib/eth-currency'
import { createOrder, simulateOrderPayment } from '@/lib/order-api'
import { useSocket } from '@/lib/socket-context'
import type { CreateOrderPayload, Order } from '@/mocks/contracts'

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

const IDEMPOTENCY_STORAGE_KEY = 'nft_checkout_idempotency_key'

function getOrCreateIdempotencyKey(userId: string): string {
  if (typeof window === 'undefined') return 'idem-ssr'
  const stored = window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY)
  if (stored) return stored
  const newKey = `idem-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  window.sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, newKey)
  return newKey
}

function clearIdempotencyKey(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY)
  }
}

export function CheckoutPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { items, totalQuantity, quote, isQuoteLoading, refetchQuote } = useCart()
  const { isConnected, socketStatus, lastOrderUpdate } = useSocket()
  const navigate = useNavigate()

  // Buyer Form fields
  const [customBuyerName, setCustomBuyerName] = useState<string | null>(null)
  const [customBuyerEmail, setCustomBuyerEmail] = useState<string | null>(null)
  const buyerName = customBuyerName ?? user?.name ?? ''
  const buyerEmail = customBuyerEmail ?? user?.email ?? ''

  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; wallet?: string }>({})

  // Simulated Wallet & Network State
  const [selectedWallet, setSelectedWallet] = useState('metamask')
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [isConnectingWallet, setIsConnectingWallet] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')

  const isWalletConnectedRef = useRef(false)
  const walletAddressRef = useRef('')

  // Order & Processing State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTimeoutError, setIsTimeoutError] = useState(false)
  const [declineReason, setDeclineReason] = useState<string | null>(null)

  // Quote Revalidation State
  const [lastAcceptedTotal, setLastAcceptedTotal] = useState<string | null>(null)
  const [quoteChangeNotice, setQuoteChangeNotice] = useState<string | null>(null)
  const previousTotalRef = useRef<string | null>(null)
  const previousFingerprintRef = useRef<string | null>(null)

  const nameInputId = useId()
  const emailInputId = useId()
  const walletSelectId = useId()
  const networkSelectId = useId()

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && window.location.pathname.startsWith('/checkout')) {
      void navigate({ to: '/login', search: { redirect: '/checkout' } })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

  // Track quote changes and require explicit re-acceptance
  useEffect(() => {
    if (quote) {
      const currentSignature = `${quote.totalEth}|${(quote.conflicts ?? []).map((c) => c.type).join(',')}`
      if (previousFingerprintRef.current !== null && previousFingerprintRef.current !== currentSignature) {
        queueMicrotask(() => {
          if (quote.conflicts && quote.conflicts.length > 0) {
            setQuoteChangeNotice(
              `Atenção: Houve alteração no estoque ou disponibilidade dos itens (${quote.conflicts.map((c) => c.message).join('; ')}).`,
            )
          } else {
            setQuoteChangeNotice(
              `O total da cotação foi atualizado de ${previousTotalRef.current ?? ''} ETH para ${quote.totalEth} ETH devido a alterações de preço ou taxas.`,
            )
          }
        })
      } else if (lastAcceptedTotal === null) {
        queueMicrotask(() => {
          setLastAcceptedTotal(quote.totalEth)
        })
      }
      previousFingerprintRef.current = currentSignature
      previousTotalRef.current = quote.totalEth
    }
  }, [quote, lastAcceptedTotal])

  // React to order.updated from socket
  useEffect(() => {
    if (lastOrderUpdate && currentOrder && lastOrderUpdate.orderId === currentOrder.id) {
      if (lastOrderUpdate.status === 'confirmed') {
        clearIdempotencyKey()
        void navigate({ to: '/pedidos/$orderId', params: { orderId: currentOrder.id } })
      } else if (lastOrderUpdate.status === 'declined') {
        queueMicrotask(() => {
          setCurrentOrder((prev) => (prev ? { ...prev, status: 'declined', declineReason: lastOrderUpdate.declineReason } : null))
          setDeclineReason(lastOrderUpdate.declineReason || 'Pagamento recusado pela carteira.')
          setIsSubmitting(false)
        })
      }
    }
  }, [lastOrderUpdate, currentOrder, navigate])

  const handleConnectWallet = () => {
    const mockAddr =
      selectedWallet === 'coinbase'
        ? '0xC01b...7a4F'
        : selectedWallet === 'rainbow'
          ? '0x8A2c...5e19'
          : '0x71C3...98B2'
    isWalletConnectedRef.current = true
    walletAddressRef.current = mockAddr
    setIsConnectingWallet(false)
    setIsWalletConnected(true)
    setWalletAddress(mockAddr)
    setFormErrors((prev) => ({ ...prev, wallet: undefined }))
  }

  const handleDisconnectWallet = () => {
    isWalletConnectedRef.current = false
    walletAddressRef.current = ''
    setIsWalletConnected(false)
    setWalletAddress('')
  }

  const validateForm = (): boolean => {
    const errors: { name?: string; email?: string; wallet?: string } = {}
    if (!buyerName.trim() || buyerName.trim().length < 2) {
      errors.name = 'Nome completo é obrigatório (mínimo 2 caracteres).'
    }
    if (!buyerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      errors.email = 'E-mail válido é obrigatório para envio do recibo.'
    }
    const connected = isWalletConnected || isWalletConnectedRef.current
    const addr = walletAddress || walletAddressRef.current
    if (!connected || !addr) {
      errors.wallet = 'Conecte sua carteira simulada para continuar.'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAcceptNewQuote = () => {
    if (quote) {
      setLastAcceptedTotal(quote.totalEth)
      setQuoteChangeNotice(null)
    }
  }

  const executeOrderSubmission = async () => {
    if (!user) return
    if (!validateForm()) return
    if (!quote || hasUnresolvableConflict) {
      setErrorMessage('Cotação inválida ou com conflitos de estoque. Verifique os itens no carrinho.')
      return
    }

    if (selectedNetwork === 'solana') {
      setErrorMessage('Rede incompatível. Selecione uma rede compatível com ETH (Ethereum, Polygon ou Arbitrum).')
      return
    }

    // Must accept new quote if price/stock changed
    if (quoteChangeNotice) {
      setErrorMessage('Aceite a nova cotação atualizada antes de confirmar a compra.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setIsTimeoutError(false)
    setDeclineReason(null)

    const idempotencyKey = getOrCreateIdempotencyKey(user.id)

    const payload: CreateOrderPayload = {
      idempotencyKey,
      buyer: {
        name: buyerName.trim(),
        email: buyerEmail.trim(),
        walletAddress: (walletAddress || walletAddressRef.current).trim(),
        network: selectedNetwork,
      },
      items: quote.items.map((i) => ({
        nftId: i.nftId,
        editionId: i.editionId,
        quantity: i.quantity,
        unitPriceEth: i.unitPriceEth,
      })),
      subtotalEth: quote.subtotalEth,
      discountEth: quote.discountEth,
      networkFeeEth: quote.networkFeeEth,
      totalEth: quote.totalEth,
      couponCode: quote.coupon?.code ?? null,
    }

    try {
      // 1. Criar pedido com idempotência
      const order = await createOrder(payload)
      setCurrentOrder(order)

      // 2. Simular pagamento
      const paidOrder = await simulateOrderPayment(order.id)
      setCurrentOrder(paidOrder)

      if (paidOrder.status === 'confirmed') {
        clearIdempotencyKey()
        void navigate({ to: '/pedidos/$orderId', params: { orderId: paidOrder.id } })
      } else if (paidOrder.status === 'declined') {
        setDeclineReason(paidOrder.declineReason || 'Pagamento recusado pela carteira.')
        setIsSubmitting(false)
      } else {
        // Pending: aguarda socket ou consulta posterior
        setIsSubmitting(false)
      }
    } catch (err: unknown) {
      setIsSubmitting(false)
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 504) {
          setIsTimeoutError(true)
          setErrorMessage(
            'Ocorreu um timeout após o processamento no servidor. Clique em "Tentar novamente" para recuperar o mesmo pedido com segurança.',
          )
          return
        }
        if (err.response?.status === 409) {
          const msg = String(err.response?.data?.message || '')
          if (err.response?.data?.conflict || msg.includes('PRECO') || msg.includes('ESTOQUE')) {
            await refetchQuote()
            setErrorMessage(msg || 'A cotação ou estoque mudou. Revalide seu pedido.')
          } else {
            setErrorMessage(msg || 'Conflito de idempotência na compra.')
          }
          return
        }
        if (err.response?.data?.message) {
          setErrorMessage(String(err.response.data.message))
          return
        }
      }
      setErrorMessage(err instanceof Error ? err.message : 'Falha na comunicação com a API simulada.')
    }
  }

  const hasUnresolvableConflict = Boolean(
    quote?.conflicts?.some((c) => c.type === 'item_unavailable' || c.type === 'stock_exceeded'),
  )

  const isNetworkIncompatible = selectedNetwork === 'solana'

  if (isAuthLoading) {
    return (
      <div className="min-h-svh bg-background font-mono text-foreground">
        <MarketplaceHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="animate-pulse text-sm text-muted-foreground">Verificando sessão de colecionador...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-background font-mono text-foreground">
      <MarketplaceHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-9 lg:px-10">
        {/* Header and Breadcrumbs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-5">
          <div>
            <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/" search={catalogSearchDefaults} className="hover:text-foreground">Início</Link>
              <span aria-hidden="true">/</span>
              <Link to="/carrinho" className="hover:text-foreground">Carrinho</Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-foreground" aria-current="page">Pagamento</span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Checkout e Pagamento</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Finalize sua aquisição com carteira simulada, cotação garantida e idempotência de compra.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isConnected
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span className={`size-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              Socket.IO: {isConnected ? 'Ativo' : socketStatus}
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="checkout-error-alert"
            className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs font-medium text-destructive"
          >
            <p className="font-bold">Aviso no processamento do pedido:</p>
            <p className="mt-1">{errorMessage}</p>
            {isTimeoutError && (
              <button
                type="button"
                data-testid="retry-after-timeout-btn"
                onClick={() => void executeOrderSubmission()}
                className="mt-3 inline-flex items-center rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:opacity-90"
              >
                Tentar novamente com a mesma chave
              </button>
            )}
          </div>
        )}

        {/* Quote Change or Conflict Banner */}
        {(Boolean(quoteChangeNotice) || hasUnresolvableConflict) && (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="quote-change-alert"
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-medium text-amber-200"
          >
            <p className="font-bold text-amber-400">Alteração detectada na cotação oficial:</p>
            <p className="mt-1">
              {quoteChangeNotice ||
                (quote?.conflicts && quote.conflicts.length > 0
                  ? quote.conflicts.map((c) => c.message).join('; ')
                  : 'A cotação foi alterada ou possui itens com conflito de estoque.')}
            </p>
            {!hasUnresolvableConflict && (
              <button
                type="button"
                data-testid="accept-new-quote-btn"
                onClick={handleAcceptNewQuote}
                className="mt-3 inline-flex items-center rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-300"
              >
                Aceitar nova cotação e continuar
              </button>
            )}
          </div>
        )}

        {/* Pending Order Status Banner */}
        {currentOrder?.status === 'pending' && (
          <div
            role="status"
            data-testid="payment-status-pending"
            className="mb-6 rounded-xl border border-primary/40 bg-primary/10 p-4 text-xs font-medium text-primary"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 animate-ping rounded-full bg-primary" />
              <p className="font-bold">Pagamento pendente de confirmação</p>
            </div>
            <p className="mt-1 text-muted-foreground">
              O pedido {currentOrder.id} foi registrado no servidor simulado. Aguardando confirmação em tempo real...
            </p>
          </div>
        )}

        {/* Declined Order Banner */}
        {declineReason && (
          <div
            role="alert"
            data-testid="payment-declined-alert"
            className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs font-medium text-destructive"
          >
            <p className="font-bold">Pagamento Recusado:</p>
            <p className="mt-1">{declineReason}</p>
            <p className="mt-2 text-muted-foreground">
              Seus itens continuam intactos no carrinho. Você pode alterar a carteira ou tentar novamente.
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <h2 className="text-xl font-bold">Nenhum item selecionado para compra</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Adicione obras de arte ao carrinho antes de prosseguir com o pagamento.
            </p>
            <Link
              to="/carrinho"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary-light"
            >
              Voltar ao carrinho
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            {/* Form Column */}
            <div className="space-y-6">
              {/* Buyer Info Card */}
              <section
                aria-labelledby="buyer-info-heading"
                className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm"
              >
                <h2 id="buyer-info-heading" className="text-base font-bold text-foreground">
                  1. Dados do colecionador
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Identificação do titular para emissão do recibo e snapshot da aquisição.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={nameInputId} className="block text-xs font-semibold text-foreground">
                      Nome completo
                    </label>
                    <input
                      id={nameInputId}
                      data-testid="buyer-name-input"
                      type="text"
                      value={buyerName}
                      onChange={(e) => {
                        setCustomBuyerName(e.target.value)
                        setFormErrors((prev) => ({ ...prev, name: undefined }))
                      }}
                      className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                      placeholder="Nome do colecionador"
                    />
                    {formErrors.name && (
                      <p role="alert" className="mt-1 text-[11px] font-semibold text-destructive">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={emailInputId} className="block text-xs font-semibold text-foreground">
                      E-mail de confirmação
                    </label>
                    <input
                      id={emailInputId}
                      data-testid="buyer-email-input"
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => {
                        setCustomBuyerEmail(e.target.value)
                        setFormErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                      placeholder="seu.email@exemplo.com"
                    />
                    {formErrors.email && (
                      <p role="alert" className="mt-1 text-[11px] font-semibold text-destructive">
                        {formErrors.email}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Wallet and Network Card */}
              <section
                aria-labelledby="wallet-heading"
                className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="wallet-heading" className="text-base font-bold text-foreground">
                      2. Carteira e rede simuladas
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ambiente de teste sem conexões com redes blockchain reais ou assinaturas criptográficas reais.
                    </p>
                  </div>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    SIMULAÇÃO
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={walletSelectId} className="block text-xs font-semibold text-foreground">
                      Provedor de carteira
                    </label>
                    <select
                      id={walletSelectId}
                      data-testid="wallet-select"
                      value={selectedWallet}
                      onChange={(e) => {
                        setSelectedWallet(e.target.value)
                        if (isWalletConnected) {
                          handleConnectWallet()
                        }
                      }}
                      className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <option value="metamask">MetaMask (Simulada)</option>
                      <option value="coinbase">Coinbase Wallet (Simulada)</option>
                      <option value="rainbow">Rainbow (Simulada)</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-border-soft bg-surface-raised p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground">Status da conexão:</span>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`size-2.5 rounded-full ${
                              isWalletConnected ? 'bg-emerald-400' : 'bg-muted-foreground'
                            }`}
                          />
                          <span
                            data-testid="wallet-connection-status"
                            className="text-xs font-bold text-foreground"
                          >
                            {isWalletConnected ? 'Carteira Conectada' : 'Não conectada'}
                          </span>
                        </div>
                      </div>

                      {isWalletConnected ? (
                        <button
                          type="button"
                          onClick={handleDisconnectWallet}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="connect-wallet-btn"
                          onClick={handleConnectWallet}
                          disabled={isConnectingWallet}
                          className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50"
                        >
                          {isConnectingWallet ? 'Conectando...' : 'Conectar Carteira'}
                        </button>
                      )}
                    </div>

                    {isWalletConnected && (
                      <div className="mt-3 border-t border-border-soft pt-3 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Endereço:</span>
                          <span data-testid="buyer-wallet-address" className="font-mono font-semibold text-foreground">
                            {walletAddress}
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between text-muted-foreground">
                          <span>Saldo simulado:</span>
                          <span className="font-mono font-semibold text-emerald-400">4.5000 ETH</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {formErrors.wallet && (
                    <p role="alert" className="text-[11px] font-semibold text-destructive">
                      {formErrors.wallet}
                    </p>
                  )}

                  <div>
                    <label htmlFor={networkSelectId} className="block text-xs font-semibold text-foreground">
                      Rede blockchain
                    </label>
                    <select
                      id={networkSelectId}
                      data-testid="network-select"
                      value={selectedNetwork}
                      onChange={(e) => setSelectedNetwork(e.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <option value="ethereum">Ethereum Mainnet (Padrão)</option>
                      <option value="polygon">Polygon Network (Simulada)</option>
                      <option value="arbitrum">Arbitrum One (Simulada)</option>
                      <option value="solana">Solana (Incompatível com ETH)</option>
                    </select>

                    {isNetworkIncompatible && (
                      <p role="alert" className="mt-1.5 text-[11px] font-bold text-destructive">
                        A rede selecionada é incompatível com o pagamento em ETH deste desafio. Escolha Ethereum, Polygon ou Arbitrum.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Summary & Confirmation Column */}
            <div>
              <aside
                aria-labelledby="checkout-summary-heading"
                className="sticky top-6 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm"
              >
                <h2 id="checkout-summary-heading" className="text-base font-bold text-foreground">
                  Resumo da compra
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {totalQuantity} {totalQuantity === 1 ? 'NFT selecionado' : 'NFTs selecionados'}
                </p>

                {/* Items List Mini */}
                <ul className="mt-4 max-h-60 space-y-3 overflow-y-auto border-b border-border-soft pb-4">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-10 shrink-0 rounded-lg object-cover bg-surface-raised"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Qtd: {item.quantity} · {formatEthDisplay(item.unitPriceEth)} ETH
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-foreground">
                        {formatEthDisplay(item.subtotalEth)} ETH
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Pricing Summary */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium text-foreground">
                      {quote ? formatEthDisplay(quote.subtotalEth) : '0.00'} ETH
                    </span>
                  </div>

                  {quote?.coupon && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Desconto ({quote.coupon.code} - {quote.coupon.discountPercent}%)</span>
                      <span className="font-mono font-medium">
                        -{formatEthDisplay(quote.coupon.discountEth)} ETH
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa de rede estimada</span>
                    <span className="font-mono font-medium text-foreground">
                      {quote ? formatEthDisplay(quote.networkFeeEth) : '0.0025'} ETH
                    </span>
                  </div>

                  <div className="border-t border-border-soft pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-foreground">Total da compra</span>
                      <div className="text-right">
                        <span
                          data-testid="order-summary-total"
                          className="text-xl font-extrabold tracking-tight text-primary tabular-nums"
                        >
                          {quote ? formatEth(quote.totalEth) : '0.00'} ETH
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {isQuoteLoading ? 'Revalidando cotação...' : 'Cotação oficial garantida'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Purchase Action */}
                <button
                  type="button"
                  data-testid="confirm-purchase-btn"
                  disabled={
                    isSubmitting ||
                    isNetworkIncompatible ||
                    Boolean(quoteChangeNotice) ||
                    hasUnresolvableConflict ||
                    !quote
                  }
                  onClick={() => void executeOrderSubmission()}
                  className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Processando compra...'
                    : quoteChangeNotice
                      ? 'Aceite a nova cotação'
                      : isNetworkIncompatible
                        ? 'Rede incompatível'
                        : 'Confirmar e Finalizar Compra'}
                </button>

                <p className="mt-3 text-center text-[10px] text-muted-foreground">
                  Simulação protegida com chave de idempotência de compra única.
                </p>
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
