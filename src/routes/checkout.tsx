import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useId, useRef, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/lib/auth-context'
import { useCart } from '@/lib/cart-context'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { formatEthDisplay } from '@/lib/eth-currency'
import { createOrder, simulateOrderPayment } from '@/lib/order-api'
import { fetchUserWallets } from '@/lib/profile-api'
import { useSocket } from '@/lib/socket-context'
import type { CreateOrderPayload, Order, Wallet } from '@/mocks/contracts'

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

function formatDisplayAddress(address: string): string {
  if (!address) return ''
  if (address.includes('...')) return address
  if (address.length > 12) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  return address
}

function CheckoutPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { items, quote, refetchQuote, applyCoupon } = useCart()
  const { isConnected, socketStatus, lastOrderUpdate } = useSocket()
  const navigate = useNavigate()

  const { data: walletsData } = useQuery({
    queryKey: ['wallets'],
    queryFn: ({ signal }) => fetchUserWallets(signal),
    enabled: isAuthenticated,
  })
  const userWallets = walletsData?.items ?? []

  const [customBuyerName, setCustomBuyerName] = useState<string | null>(null)
  const [customBuyerEmail, setCustomBuyerEmail] = useState<string | null>(null)
  const buyerName = customBuyerName ?? user?.name ?? ''
  const buyerEmail = customBuyerEmail ?? user?.email ?? ''

  const [customUsername, setCustomUsername] = useState<string | null>(null)
  const [customProfileName, setCustomProfileName] = useState<string | null>(null)
  const username = customUsername ?? (user ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '')
  const profileName = customProfileName ?? 'Colecionador Kurio'

  const [secondaryWallet, setSecondaryWallet] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [ensDomain, setEnsDomain] = useState('.eth')
  const [collectorNotes, setCollectorNotes] = useState('')
  const [showOtherWallets, setShowOtherWallets] = useState(false)
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)

  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; wallet?: string }>({})

  const [selectedWallet, setSelectedWallet] = useState('metamask')
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [isConnectingWallet, setIsConnectingWallet] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')
  const [activeWalletProfile, setActiveWalletProfile] = useState<'principal' | 'reserva'>('principal')

  const isWalletConnectedRef = useRef(false)
  const walletAddressRef = useRef('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTimeoutError, setIsTimeoutError] = useState(false)
  const [declineReason, setDeclineReason] = useState<string | null>(null)

  const [lastAcceptedTotal, setLastAcceptedTotal] = useState<string | null>(null)
  const [quoteChangeNotice, setQuoteChangeNotice] = useState<string | null>(null)
  const previousTotalRef = useRef<string | null>(null)
  const previousFingerprintRef = useRef<string | null>(null)

  const nameInputId = useId()
  const emailInputId = useId()
  const walletSelectId = useId()
  const networkSelectId = useId()

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && window.location.pathname.startsWith('/checkout')) {
      void navigate({ to: '/login', search: { redirect: '/checkout' } })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

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

  const handleConnectWallet = (provider = selectedWallet) => {
    let mockAddr = '0x71C3...98B2'
    if (provider === 'coinbase') {
      mockAddr = '0xC01b...7a4F'
    } else if (provider === 'rainbow') {
      mockAddr = '0x8A2c...5e19'
    }
    isWalletConnectedRef.current = true
    walletAddressRef.current = mockAddr
    setIsConnectingWallet(false)
    setIsWalletConnected(true)
    setWalletAddress(mockAddr)
    setSelectedWallet(provider)
    setFormErrors((prev) => ({ ...prev, wallet: undefined }))
  }

  const handleSelectLinkedWallet = (wallet: Wallet) => {
    isWalletConnectedRef.current = true
    walletAddressRef.current = wallet.address
    setIsConnectingWallet(false)
    setIsWalletConnected(true)
    setWalletAddress(wallet.address)
    setSelectedWallet(wallet.provider || 'metamask')
    setFormErrors((prev) => ({ ...prev, wallet: undefined }))
  }

  const handleDisconnectWallet = () => {
    isWalletConnectedRef.current = false
    walletAddressRef.current = ''
    setIsWalletConnected(false)
    setWalletAddress('')
  }

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoCodeInput.trim()) return
    try {
      setPromoError(null)
      await applyCoupon(promoCodeInput.trim())
      setShowPromoInput(false)
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Cupom inválido')
    }
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
      const order = await createOrder(payload)
      setCurrentOrder(order)

      const paidOrder = await simulateOrderPayment(order.id)
      setCurrentOrder(paidOrder)

      if (paidOrder.status === 'confirmed') {
        clearIdempotencyKey()
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(`order_${paidOrder.id}`, JSON.stringify(paidOrder))
            window.sessionStorage.setItem('last_created_order', JSON.stringify(paidOrder))
          } catch  {
      void 0
    }
        }
        void navigate({ to: '/pedidos/$orderId', params: { orderId: paidOrder.id } })
      } else if (paidOrder.status === 'declined') {
        setDeclineReason(paidOrder.declineReason || 'Pagamento recusado pela carteira.')
        setIsSubmitting(false)
      } else {
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
        <MarketplaceHeader showMobileTabBar={false} showMobileHeader={false} />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="animate-pulse text-sm text-muted-foreground">Verificando sessão de colecionador...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-[#0a0908] font-mono text-foreground flex flex-col justify-between">
      <div>
        <MarketplaceHeader showMobileTabBar={false} showMobileHeader={false} />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Link to="/" search={catalogSearchDefaults} className="hover:text-foreground">Início</Link>
                <span aria-hidden="true">/</span>
                <Link to="/" search={catalogSearchDefaults} className="hover:text-foreground">Mercado</Link>
                <span aria-hidden="true">/</span>
                <span className="font-semibold text-foreground" aria-current="page">Pagamento</span>
              </nav>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  aria-label="Voltar"
                  className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground hover:border-primary md:hidden"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="font-mono text-base sm:text-lg font-bold text-foreground">
                  <span className="md:hidden">Pagamento com carteira <span className="sr-only">· </span></span>
                  <span>Checkout e Pagamento</span>
                </h1>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isConnected
                    ? 'border border-success/30 bg-success/10 text-success'
                    : 'border border-warning/30 bg-warning/10 text-warning'
                }`}
              >
                <span className={`size-2 rounded-full ${isConnected ? 'bg-success' : 'bg-warning animate-pulse'}`} />
                Socket.IO: {isConnected ? 'Ativo' : socketStatus}
              </span>
            </div>
          </div>

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
            <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
              <div className="space-y-6">
                <section aria-labelledby="perfil-colecionador-heading" className="space-y-4">
                  <h2 id="perfil-colecionador-heading" className="font-mono text-base font-bold text-foreground">
                    Perfil do colecionador
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 font-mono text-xs">
                    <div>
                      <label htmlFor={nameInputId} className="block text-xs font-mono text-foreground mb-1.5">
                        Nome de exibição<span className="text-[#f59e0b] ml-0.5">*</span>
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
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                        placeholder="Nome de exibição"
                      />
                      {formErrors.name && (
                        <p role="alert" className="mt-1 text-[11px] font-semibold text-destructive">
                          {formErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="username-input" className="block text-xs font-mono text-foreground mb-1.5">
                        Nome de usuário<span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <input
                        id="username-input"
                        type="text"
                        value={username}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                        placeholder="@usuario"
                      />
                    </div>

                    <div>
                      <label htmlFor={networkSelectId} className="block text-xs font-mono text-foreground mb-1.5">
                        Rede <span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <select
                        id={networkSelectId}
                        data-testid="network-select"
                        value={selectedNetwork}
                        onChange={(e) => setSelectedNetwork(e.target.value)}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                      >
                        <option value="ethereum">Selecione uma rede</option>
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

                    <div>
                      <label htmlFor="profile-name-input" className="block text-xs font-mono text-foreground mb-1.5">
                        Nome do perfil<span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <input
                        id="profile-name-input"
                        type="text"
                        value={profileName}
                        onChange={(e) => setCustomProfileName(e.target.value)}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                        placeholder="Nome do perfil"
                      />
                    </div>

                    <div>
                      <label htmlFor="wallet-address-input" className="block text-xs font-mono text-foreground mb-1.5">
                        Endereço da carteira<span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <input
                        id="wallet-address-input"
                        type="text"
                        placeholder="Endereço 0x da carteira"
                        value={walletAddress}
                        onChange={(e) => {
                          setWalletAddress(e.target.value)
                          walletAddressRef.current = e.target.value
                          if (e.target.value) {
                            setIsWalletConnected(true)
                            isWalletConnectedRef.current = true
                            setFormErrors((prev) => ({ ...prev, wallet: undefined }))
                          }
                        }}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#f59e0b] focus:outline-none font-mono"
                      />
                      {formErrors.wallet && (
                        <p role="alert" className="mt-1 text-[11px] font-semibold text-destructive">
                          {formErrors.wallet}
                        </p>
                      )}
                    </div>

                    <div className="md:pt-[22px]">
                      <input
                        type="text"
                        placeholder="ENS ou carteira secundária (opcional)"
                        value={secondaryWallet}
                        onChange={(e) => setSecondaryWallet(e.target.value)}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#f59e0b] focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor={walletSelectId} className="block text-xs font-mono text-foreground mb-1.5">
                        Tipo de carteira<span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <select
                        id={walletSelectId}
                        data-testid="wallet-select"
                        value={selectedWallet}
                        onChange={(e) => {
                          setSelectedWallet(e.target.value)
                          if (isWalletConnected) handleConnectWallet(e.target.value)
                        }}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                      >
                        <option value="metamask">Selecione uma carteira</option>
                        <option value="metamask">MetaMask (Simulada)</option>
                        <option value="coinbase">Coinbase Wallet (Simulada)</option>
                        <option value="rainbow">Rainbow (Simulada)</option>
                        <option value="walletconnect">WalletConnect (Simulada)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="referral-code-input" className="block text-xs font-mono text-foreground mb-1.5">
                        Código de indicação<span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <input
                        id="referral-code-input"
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none font-mono"
                        placeholder="KURIO-REF"
                      />
                    </div>

                    <div>
                      <label htmlFor={emailInputId} className="block text-xs font-mono text-foreground mb-1.5">
                        E-mail<span className="text-[#f59e0b] ml-0.5">*</span>
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
                        className="h-10 w-full rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                        placeholder="seu.email@exemplo.com"
                      />
                      {formErrors.email && (
                        <p role="alert" className="mt-1 text-[11px] font-semibold text-destructive">
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="ens-domain-select" className="block text-xs font-mono text-foreground mb-1.5">
                        Nome ENS <span className="text-[#f59e0b] ml-0.5">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          id="ens-domain-select"
                          value={ensDomain}
                          onChange={(e) => setEnsDomain(e.target.value)}
                          className="h-10 rounded border border-[#2d241e] bg-[#14100c] px-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none"
                        >
                          <option value=".eth">.eth</option>
                          <option value=".kurio">.kurio</option>
                          <option value=".xyz">.xyz</option>
                        </select>
                      </div>
                    </div>

                    <div className="py-2">
                      <button
                        type="button"
                        onClick={() => setShowOtherWallets(!showOtherWallets)}
                        className="flex items-center gap-2 text-xs font-mono text-foreground hover:text-[#f59e0b] transition"
                      >
                        <span className={`size-3.5 rounded-full border flex items-center justify-center ${showOtherWallets ? 'border-[#f59e0b]' : 'border-[#4a3b30]'}`}>
                          {showOtherWallets && <span className="size-2 rounded-full bg-[#f59e0b]" />}
                        </span>
                        <span>Usar outra carteira?</span>
                      </button>
                    </div>

                    <div />

                    {showOtherWallets && (
                      <div className="col-span-1 md:col-span-2 space-y-2 rounded border border-[#2d241e] bg-[#14100c] p-3 text-xs font-mono">
                        <p className="text-[11px] font-bold text-muted-foreground">Carteiras vinculadas à sua conta:</p>
                        {userWallets.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            Nenhuma carteira salva no perfil.{' '}
                            <Link to="/perfil" search={{ tab: 'carteiras' }} className="text-[#f59e0b] hover:underline">
                              Vincular nova carteira no perfil
                            </Link>
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {userWallets.map((w) => (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => handleSelectLinkedWallet(w)}
                                className={`flex items-center justify-between rounded border p-2 text-left transition ${
                                  walletAddress === w.address
                                    ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-foreground'
                                    : 'border-[#2d241e] hover:border-[#f59e0b]/40 text-muted-foreground'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-bold text-foreground">{w.label || w.provider}</span>
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">({w.isPrimary ? 'Principal' : 'Secundária'})</span>
                                  <p className="font-mono text-[11px] truncate">{w.address}</p>
                                </div>
                                {walletAddress === w.address && <span className="text-[#f59e0b] text-xs shrink-0">✓ Ativa</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="col-span-1 md:col-span-1">
                      <label htmlFor="collector-notes" className="block text-xs font-mono text-foreground mb-1.5">
                        Observação do colecionador (opcional)
                      </label>
                      <textarea
                        id="collector-notes"
                        rows={4}
                        value={collectorNotes}
                        onChange={(e) => setCollectorNotes(e.target.value)}
                        className="w-full rounded border border-[#2d241e] bg-[#14100c] p-3 text-xs text-foreground focus:border-[#f59e0b] focus:outline-none resize-none"
                        placeholder="Observações sobre o lote ou recebimento..."
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-[#2d241e] bg-[#14100c] p-3 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${isWalletConnected ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                      <span data-testid="wallet-connection-status" className="font-bold text-foreground">
                        {isWalletConnected ? 'Carteira Conectada' : 'Não conectada'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <span data-testid="buyer-wallet-address" className="font-mono text-xs text-muted-foreground truncate max-w-50 sm:max-w-none">
                        {formatDisplayAddress(walletAddress)}
                      </span>
                      {isWalletConnected ? (
                        <button
                          type="button"
                          onClick={handleDisconnectWallet}
                          className="rounded border border-[#2d241e] px-2.5 py-1 text-[11px] text-muted-foreground hover:text-red-400 transition shrink-0"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="connect-wallet-btn"
                          onClick={() => handleConnectWallet()}
                          disabled={isConnectingWallet}
                          className="rounded bg-[#e58c38] px-3 py-1 text-[11px] font-bold text-black hover:bg-[#f59e0b] transition disabled:opacity-50 shrink-0"
                        >
                          {isConnectingWallet ? 'Conectando...' : 'Conectar Carteira'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="md:hidden space-y-3">
                  <h3 className="font-mono text-xs font-bold text-foreground">Carteira conectada</h3>
                  <div
                    onClick={() => {
                      const nextProfile = activeWalletProfile === 'principal' ? 'reserva' : 'principal'
                      setActiveWalletProfile(nextProfile)
                      setSelectedNetwork(nextProfile === 'principal' ? 'ethereum' : 'polygon')
                      if (!isWalletConnected) handleConnectWallet()
                    }}
                    className="flex items-center justify-between rounded-xl border border-primary/70 bg-card p-3 cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-foreground">
                        {activeWalletProfile === 'principal' ? 'Principal' : 'Reserva'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{formatDisplayAddress(walletAddress) || '0x71C3...98B2'}</p>
                    </div>
                    <span className="text-[11px] text-primary">
                      {activeWalletProfile === 'principal' ? 'Rede Ethereum' : 'Rede Polygon'}
                    </span>
                  </div>
                </section>
              </div>

              <div>
                <aside aria-labelledby="seus-nfts-heading" className="space-y-3">
                  <h2 id="seus-nfts-heading" className="font-mono text-base font-bold text-foreground">
                    Seus NFTs
                  </h2>

                  <div className="rounded-xl border border-[#2d241e] bg-[#14100c] p-5 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between font-bold text-foreground border-b border-[#2d241e] pb-2 text-xs">
                      <span>NFTs</span>
                      <span>Subtotal</span>
                    </div>

                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="size-12 shrink-0 rounded-lg object-cover bg-surface-raised border border-[#2d241e]"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground text-xs leading-tight">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                ID do token: #{item.editionNumber || item.id.slice(0, 4)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted-foreground text-[11px] whitespace-nowrap">(x {item.quantity})</span>
                            <span className="font-mono font-bold text-[#f59e0b] text-xs tabular-nums whitespace-nowrap">
                              {formatEthDisplay(item.subtotalEth)} ETH
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-[#2d241e] pt-3 text-center">
                      {showPromoInput ? (
                        <form onSubmit={handleApplyPromo} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="CUPOM"
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value)}
                            className="h-8 flex-1 rounded border border-[#2d241e] bg-[#0a0908] px-2 text-xs text-foreground uppercase focus:border-[#f59e0b] focus:outline-none font-mono"
                          />
                          <button
                            type="submit"
                            className="rounded bg-[#e58c38] px-3 py-1 text-xs font-bold text-black hover:bg-[#f59e0b]"
                          >
                            Aplicar
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowPromoInput(true)}
                          className="text-xs text-[#d97706] hover:text-[#f59e0b] transition font-mono"
                        >
                          Tem um código promocional? Aplique aqui
                        </button>
                      )}
                      {promoError && <p className="mt-1 text-[11px] text-destructive">{promoError}</p>}
                      {quote?.coupon && (
                        <p className="mt-1 text-[11px] text-success">
                          ✓ Cupom {quote.coupon.code} aplicado ({quote.coupon.discountPercent}% OFF)
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#2d241e] pt-3 space-y-2 text-xs text-muted-foreground font-mono">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-mono text-foreground font-medium">
                          {quote ? formatEthDisplay(quote.subtotalEth) : '0.00'} ETH
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Desconto {quote?.coupon ? `(${quote.coupon.code})` : 'do lançamento'}</span>
                        <span className="font-mono text-foreground font-medium">
                          {quote?.coupon ? `(-) ${formatEthDisplay(quote.coupon.discountEth)}` : '(-) 00.00'}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between">
                          <span>Taxa de rede</span>
                          <span className="font-mono text-foreground font-medium">
                            {quote ? formatEthDisplay(quote.networkFeeEth) : '0.016'} ETH
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#f59e0b] font-mono">Taxa estimada</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#2d241e] pt-3 flex items-baseline justify-between font-mono">
                      <span className="text-sm font-bold text-foreground">Total</span>
                      <span
                        data-testid="order-summary-total"
                        className="text-xl font-bold text-[#f59e0b] tabular-nums"
                      >
                        {quote ? formatEth(quote.totalEth) : '0.00'} ETH
                      </span>
                    </div>

                    <div className="border-t border-[#2d241e] pt-3 space-y-2 font-mono">
                      <h3 className="text-center text-xs font-bold text-foreground">Carteira e rede</h3>

                      <div
                        onClick={() => {
                          setSelectedWallet('walletconnect')
                          handleConnectWallet('walletconnect')
                        }}
                        className={`flex items-center gap-3 rounded border p-2.5 cursor-pointer transition text-xs ${
                          selectedWallet === 'walletconnect' && isWalletConnected
                            ? 'border-[#f59e0b] bg-[#f59e0b]/10'
                            : 'border-[#2d241e] bg-[#0a0908] hover:border-[#f59e0b]/40'
                        }`}
                      >
                        <span className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedWallet === 'walletconnect' && isWalletConnected ? 'border-[#f59e0b]' : 'border-[#4a3b30]'
                        }`}>
                          {selectedWallet === 'walletconnect' && isWalletConnected && (
                            <span className="size-2 rounded-full bg-[#f59e0b]" />
                          )}
                        </span>
                        <span className="rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-0.5 text-[9px] font-bold text-[#f59e0b] tracking-wider">
                          METAMASK · WALLETCONNECT · COINBASE
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          setSelectedWallet('metamask')
                          handleConnectWallet('metamask')
                        }}
                        className={`flex items-center gap-3 rounded border p-2.5 cursor-pointer transition text-xs ${
                          selectedWallet === 'metamask' && isWalletConnected
                            ? 'border-[#f59e0b] bg-[#f59e0b]/10'
                            : 'border-[#2d241e] bg-[#0a0908] hover:border-[#f59e0b]/40'
                        }`}
                      >
                        <span className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedWallet === 'metamask' && isWalletConnected ? 'border-[#f59e0b]' : 'border-[#4a3b30]'
                        }`}>
                          {selectedWallet === 'metamask' && isWalletConnected && (
                            <span className="size-2 rounded-full bg-[#f59e0b]" />
                          )}
                        </span>
                        <span className="font-semibold text-foreground">MetaMask</span>
                      </div>

                      <div
                        onClick={() => {
                          setSelectedWallet('coinbase')
                          handleConnectWallet('coinbase')
                        }}
                        className={`flex items-center gap-3 rounded border p-2.5 cursor-pointer transition text-xs ${
                          selectedWallet === 'coinbase' && isWalletConnected
                            ? 'border-[#f59e0b] bg-[#f59e0b]/10'
                            : 'border-[#2d241e] bg-[#0a0908] hover:border-[#f59e0b]/40'
                        }`}
                      >
                        <span className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedWallet === 'coinbase' && isWalletConnected ? 'border-[#f59e0b]' : 'border-[#4a3b30]'
                        }`}>
                          {selectedWallet === 'coinbase' && isWalletConnected && (
                            <span className="size-2 rounded-full bg-[#f59e0b]" />
                          )}
                        </span>
                        <span className="font-semibold text-foreground">Coinbase Wallet</span>
                      </div>

                      {userWallets.map((w) => {
                        const isSelected = walletAddress === w.address && isWalletConnected
                        return (
                          <div
                            key={w.id}
                            onClick={() => handleSelectLinkedWallet(w)}
                            className={`flex items-center justify-between rounded border p-2.5 cursor-pointer transition text-xs ${
                              isSelected
                                ? 'border-[#f59e0b] bg-[#f59e0b]/10'
                                : 'border-[#2d241e] bg-[#0a0908] hover:border-[#f59e0b]/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <span className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#f59e0b]' : 'border-[#4a3b30]'
                              }`}>
                                {isSelected && <span className="size-2 rounded-full bg-[#f59e0b]" />}
                              </span>
                              <div className="min-w-0 truncate">
                                <span className="font-semibold text-foreground">{w.label || w.provider}</span>
                                <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                                  ({w.address.slice(0, 6)}...{w.address.slice(-4)})
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-[#f59e0b] shrink-0">
                              {w.isPrimary ? 'PRINCIPAL' : 'VINCULADA'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

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
                      className="w-full h-11 rounded-lg bg-[#e58c38] hover:bg-[#f59e0b] text-black font-mono font-bold text-sm tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed shadow mt-4 flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        'Processando compra...'
                      ) : quoteChangeNotice ? (
                        'Aceite a nova cotação'
                      ) : isNetworkIncompatible ? (
                        'Rede incompatível'
                      ) : (
                        <>
                          <span className="hidden sm:inline">Confirmar e Finalizar Compra</span>
                          <span className="sm:hidden">Confirmar compra<span className="sr-only"> e Finalizar Compra</span></span>
                        </>
                      )}
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>

      <div className="mt-16">
        <SiteFooter />
      </div>
    </div>
  )
}
