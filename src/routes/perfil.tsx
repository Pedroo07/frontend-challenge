import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { SiteFooter } from '@/components/site-footer'
import { useAuth } from '@/lib/auth-context'
import { http } from '@/lib/http'
import { catalogSearchDefaults, formatEth } from '@/lib/catalog-options'
import { useFavorites } from '@/lib/favorites'
import { getNft } from '@/lib/nft-api'
import {
  addUserWallet,
  changePassword,
  fetchAccount,
  fetchUserOrders,
  fetchUserWallets,
  removeUserWallet,
  setPrimaryWallet,
  updateAccount,
} from '@/lib/profile-api'
import { useSocket } from '@/lib/socket-context'
import type { AddWalletPayload, NftListItem, NftListResponse, Order, OrderStatus, WalletProvider } from '@/mocks/contracts'

type ProfileSearch = {
  tab?: 'perfil' | 'pedidos' | 'carteiras' | 'interesses' | 'favoritos'
}

export const Route = createFileRoute('/perfil')({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const tab = search.tab
    if (tab === 'pedidos' || tab === 'carteiras' || tab === 'perfil' || tab === 'interesses' || tab === 'favoritos') {
      return { tab }
    }
    return { tab: 'perfil' }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  const activeTab = search.tab ?? 'perfil'
  const isFavoritesTab = activeTab === 'interesses' || activeTab === 'favoritos'
  const setActiveTab = (tab: 'perfil' | 'pedidos' | 'carteiras' | 'interesses' | 'favoritos') => {
    void navigate({ to: '/perfil', search: { tab } })
  }

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      void navigate({ to: '/login', search: { redirect: '/perfil' } })
    }
  }, [isAuthenticated, isAuthLoading, navigate])

  const accountQuery = useQuery({
    queryKey: ['account', user?.id],
    queryFn: ({ signal }) => fetchAccount(signal),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })

  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all')
  const ordersQuery = useQuery({
    queryKey: ['orders', user?.id, orderStatusFilter],
    queryFn: ({ signal }) =>
      fetchUserOrders(orderStatusFilter === 'all' ? undefined : orderStatusFilter, signal),
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })

  const walletsQuery = useQuery({
    queryKey: ['wallets', user?.id],
    queryFn: ({ signal }) => fetchUserWallets(signal),
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!socket) return

    const handleOrderUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    }

    socket.on('order.updated', handleOrderUpdate)
    return () => {
      socket.off('order.updated', handleOrderUpdate)
    }
  }, [socket, queryClient])

  if (isAuthLoading) {
    return (
      <div className="min-h-svh bg-background font-mono text-foreground">
        <MarketplaceHeader />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <div className="h-8 w-48 animate-pulse rounded bg-card" />
          <div className="mt-6 h-64 w-full animate-pulse rounded-2xl bg-card" />
        </main>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const currentUser = accountQuery.data?.user ?? user

  return (
    <div className="min-h-svh bg-background font-mono text-foreground flex flex-col justify-between">
      <div>
        <MarketplaceHeader activeNav="inicio" />

        <main className="mx-auto w-full max-w-300 px-4 py-6 sm:px-6 sm:py-10 lg:px-0">
          <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)] xl:gap-12 items-start">
            <aside aria-label="Menu do perfil" className="rounded-lg bg-card border border-border-soft p-4 sm:p-5 shadow-sm">
              <h2 className="mb-4 font-mono text-base font-bold text-foreground tracking-tight">
                Meu perfil
              </h2>

              <nav className="flex flex-col space-y-1 text-xs">
                <button
                  type="button"
                  id="tab-perfil"
                  data-testid="tab-perfil"
                  onClick={() => setActiveTab('perfil')}
                  className={`flex items-center gap-3 rounded px-3 py-2.5 transition-colors text-left ${
                    activeTab === 'perfil'
                      ? 'border-l-2 border-primary bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                >
                  <UserIcon className="size-4 shrink-0" />
                  <span>Dados do perfil</span>
                </button>

                <button
                  type="button"
                  id="tab-carteiras"
                  data-testid="tab-carteiras"
                  onClick={() => setActiveTab('carteiras')}
                  className={`flex items-center gap-3 rounded px-3 py-2.5 transition-colors text-left ${
                    activeTab === 'carteiras'
                      ? 'border-l-2 border-primary bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                >
                  <WalletIcon className="size-4 shrink-0" />
                  <span>Carteiras</span>
                </button>

                <button
                  type="button"
                  id="tab-pedidos"
                  data-testid="tab-pedidos"
                  onClick={() => setActiveTab('pedidos')}
                  className={`flex items-center gap-3 rounded px-3 py-2.5 transition-colors text-left ${
                    activeTab === 'pedidos'
                      ? 'border-l-2 border-primary bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                >
                  <ActivityCartIcon className="size-4 shrink-0" />
                  <span>Atividade</span>
                  {ordersQuery.data && ordersQuery.data.total > 0 && (
                    <span className="ml-auto rounded-full bg-surface-raised px-1.5 py-0.2 text-[10px] text-foreground">
                      {ordersQuery.data.total}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="tab-interesses"
                  data-testid="tab-interesses"
                  onClick={() => setActiveTab('favoritos')}
                  className={`flex items-center gap-3 rounded px-3 py-2.5 transition-colors text-left ${
                    isFavoritesTab
                      ? 'border-l-2 border-primary bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                >
                  <HeartOutlineIcon className="size-4 shrink-0" />
                  <span>Lista de interesse</span>
                  {favoriteIds.length > 0 && (
                    <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {favoriteIds.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('perfil')}
                  className="flex items-center gap-3 rounded px-3 py-2.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors text-left"
                >
                  <TrendingIcon className="size-4 shrink-0" />
                  <span>Ofertas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('perfil')}
                  className="flex items-center gap-3 rounded px-3 py-2.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors text-left"
                >
                  <DownloadIcon className="size-4 shrink-0" />
                  <span>Arquivos baixados</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('perfil')}
                  className="flex items-center gap-3 rounded px-3 py-2.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors text-left"
                >
                  <HelpIcon className="size-4 shrink-0" />
                  <span>Suporte</span>
                </button>

                <div className="pt-2 border-t border-border-soft/60">
                  <button
                    type="button"
                    onClick={() => void logout()}
                    aria-label="Sair da conta"
                    className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-muted-foreground hover:bg-surface-raised hover:text-destructive transition-colors text-left"
                  >
                    <LogoutIcon className="size-4 shrink-0" />
                    <span>Sair</span>
                  </button>
                </div>
              </nav>
            </aside>

            <div className="min-w-0">
              {activeTab === 'perfil' && (
                <ProfileCollectorFigmaView user={currentUser} />
              )}

              {activeTab === 'carteiras' && (
                <WalletsCollectorFigmaView
                  wallets={walletsQuery.data?.items ?? []}
                  user={currentUser}
                />
              )}

              {activeTab === 'pedidos' && (
                <OrdersHistorySection
                  orders={ordersQuery.data?.items ?? []}
                  isLoading={ordersQuery.isLoading}
                  statusFilter={orderStatusFilter}
                  onStatusFilterChange={setOrderStatusFilter}
                  onRefetch={() => void ordersQuery.refetch()}
                />
              )}

              {isFavoritesTab && (
                <FavoritesCollectorView
                  favoriteIds={favoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}


function ProfileCollectorFigmaView({
  user,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string; bio?: string }
}) {
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState(user.name)
  const [username, setUsername] = useState(user.email.split('@')[0] ?? 'colecionador')
  const [email] = useState(user.email)
  const [ensName, setEnsName] = useState('')
  const [walletNickname, setWalletNickname] = useState(user.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setDisplayName(user.name)
      if (user.bio) setWalletNickname(user.bio)
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl)
    })
  }, [user])

  const profileMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: (data) => {
      setFeedbackError(null)
      setFeedbackSuccess('Perfil atualizado com sucesso!')
      queryClient.setQueryData(['account', user.id], data)
      queryClient.setQueryData(['auth', 'session'], data.user)
    },
    onError: (err: unknown) => {
      setFeedbackSuccess(null)
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFeedbackError(String(err.response.data.message))
      } else {
        setFeedbackError('Falha ao salvar perfil. Tente novamente.')
      }
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setFeedbackError(null)
      setFeedbackSuccess('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: unknown) => {
      setFeedbackSuccess(null)
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFeedbackError(String(err.response.data.message))
      } else {
        setFeedbackError('Falha ao alterar senha. Verifique as credenciais.')
      }
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedbackSuccess(null)
    setFeedbackError(null)

    if (displayName.trim().length < 2) {
      setFeedbackError('O nome deve conter pelo menos 2 caracteres.')
      return
    }

    profileMutation.mutate({
      name: displayName.trim(),
      bio: walletNickname.trim(),
      avatarUrl,
    })

    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        setFeedbackError('A nova senha deve ter no mínimo 6 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setFeedbackError('A confirmação da nova senha não confere.')
        return
      }
      passwordMutation.mutate({ currentPassword, newPassword })
    }
  }

  return (
    <div className="font-mono">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
        Perfil do colecionador
      </h1>

      <span data-testid="profile-display-name" className="sr-only">
        {displayName}
      </span>
      <span data-testid="profile-display-email" className="sr-only">
        {email}
      </span>

      {feedbackSuccess && (
        <div
          role="status"
          aria-live="polite"
          data-testid="profile-feedback"
          className="mt-4 rounded-md border border-success/40 bg-success/10 p-3 text-xs font-semibold text-success"
        >
          {feedbackSuccess}
        </div>
      )}

      {feedbackError && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="profile-feedback"
          className="mt-4 flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
        >
          <span>{feedbackError}</span>
          <button
            type="button"
            onClick={() =>
              profileMutation.mutate({
                name: displayName.trim(),
                bio: walletNickname.trim(),
                avatarUrl,
              })
            }
            className="self-start underline hover:text-foreground text-[11px] font-bold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="mt-6">
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground">
                Nome de exibição<span className="text-primary font-bold ml-0.5">*</span>
              </label>
              <input
                type="text"
                required
                data-testid="profile-name-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                E-mail<span className="text-primary font-bold ml-0.5">*</span>
              </label>
              <input
                type="email"
                disabled
                data-testid="profile-email-input"
                value={email}
                className="mt-1 h-10 w-full rounded-md border border-border-soft bg-surface-raised/40 px-3 text-xs text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                Apelido da carteira<span className="text-primary font-bold ml-0.5">*</span>
              </label>
              <input
                type="text"
                data-testid="profile-bio-input"
                value={walletNickname}
                onChange={(e) => setWalletNickname(e.target.value)}
                placeholder="Ex: Minha carteira principal"
                className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground">
                Nome de usuário<span className="text-primary font-bold ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                Nome ENS <span className="text-primary font-bold ml-0.5">*</span>
              </label>
              <div className="mt-1 flex">
                <div className="flex items-center gap-1 border border-r-0 border-border-soft bg-surface-raised px-2.5 text-xs text-foreground rounded-l-md">
                  <span>.eth</span>
                  <span className="text-[10px] text-muted-foreground">▼</span>
                </div>
                <input
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  placeholder="nome.eth"
                  className="h-10 w-full rounded-r-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                Avatar
              </label>
              <div className="mt-1.5 flex items-center gap-4">
                <div className="size-11 rounded-full border border-border-soft bg-surface-raised grid place-items-center text-muted-foreground overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <AvatarPlaceholderIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('/avatars/ana.png')}
                  className="rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-light"
                >
                  Alterar
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border-soft/60 pt-6">
          <h3 className="text-base font-bold text-foreground">
            Alterar senha
          </h3>

          <div className="mt-4 grid gap-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-foreground">
                Senha atual
              </label>
              <div className="relative mt-1">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-md border border-border-soft bg-card px-3 pr-10 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass((s) => !s)}
                  aria-label={showCurrentPass ? 'Ocultar' : 'Exibir'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <EyeSlashIcon className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                Nova senha
              </label>
              <div className="relative mt-1">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-md border border-border-soft bg-card px-3 pr-10 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((s) => !s)}
                  aria-label={showNewPass ? 'Ocultar' : 'Exibir'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <EyeSlashIcon className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground">
                Confirmar nova senha
              </label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-md border border-border-soft bg-card px-3 pr-10 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass((s) => !s)}
                  aria-label={showConfirmPass ? 'Ocultar' : 'Exibir'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <EyeSlashIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            data-testid="save-profile-btn"
            disabled={profileMutation.isPending || passwordMutation.isPending}
            className="rounded-md bg-primary px-8 py-2.5 font-mono text-xs font-bold text-primary-foreground shadow transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {profileMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}


function WalletsCollectorFigmaView({
  wallets,
  user,
}: {
  wallets: { id: string; address: string; label?: string; provider: WalletProvider; isPrimary: boolean }[]
  user: { id: string; name: string; email: string }
}) {
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState(user.name)
  const [walletLabel, setWalletLabel] = useState('')
  const [network, setNetwork] = useState('ethereum')
  const [profileName, setProfileName] = useState(user.name)
  const [address, setAddress] = useState('')
  const [secondaryAddress, setSecondaryAddress] = useState('')
  const [provider, setProvider] = useState<WalletProvider>('metamask')
  const [referralCode, setReferralCode] = useState('')
  const [email] = useState(user.email)
  const [ensName, setEnsName] = useState('')

  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: (payload: AddWalletPayload) => addUserWallet(payload),
    onSuccess: () => {
      setFeedbackError(null)
      setFeedbackSuccess('Carteira vinculada com sucesso!')
      setAddress('')
      setWalletLabel('')
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (err: unknown) => {
      setFeedbackSuccess(null)
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFeedbackError(String(err.response.data.message))
      } else {
        setFeedbackError('Falha ao adicionar carteira.')
      }
    },
  })

  const setPrimaryMutation = useMutation({
    mutationFn: setPrimaryWallet,
    onSuccess: () => {
      setFeedbackError(null)
      setFeedbackSuccess('Carteira principal atualizada com sucesso!')
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (err: unknown) => {
      setFeedbackSuccess(null)
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFeedbackError(String(err.response.data.message))
      } else {
        setFeedbackError('Falha ao definir carteira principal.')
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: removeUserWallet,
    onSuccess: () => {
      setFeedbackError(null)
      setFeedbackSuccess('Carteira removida com sucesso!')
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (err: unknown) => {
      setFeedbackSuccess(null)
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFeedbackError(String(err.response.data.message))
      } else {
        setFeedbackError('Falha ao remover carteira.')
      }
    },
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedbackError(null)
    setFeedbackSuccess(null)
    const trimmed = address.trim()
    if (!trimmed.startsWith('0x') || trimmed.length < 10) {
      setFeedbackError('Informe um endereço de carteira válido iniciando com 0x.')
      return
    }
    addMutation.mutate({
      address: trimmed,
      label: walletLabel.trim() || undefined,
      provider,
      isPrimary: wallets.length === 0,
    })
  }

  return (
    <div className="font-mono">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Carteira principal
        </h1>
        <button
          type="button"
          data-testid="open-add-wallet-btn"
          onClick={() => {
            setAddress('0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''))
          }}
          className="text-xs font-semibold text-primary hover:underline transition-colors"
        >
          Adicionar
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
      </p>

      {feedbackSuccess && (
        <div
          role="status"
          aria-live="polite"
          data-testid="wallet-feedback"
          className="mt-4 rounded-md border border-success/40 bg-success/10 p-3 text-xs font-semibold text-success"
        >
          {feedbackSuccess}
        </div>
      )}

      {feedbackError && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="wallet-feedback"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
        >
          {feedbackError}
        </div>
      )}

      <div data-testid="add-wallet-section">
        <form onSubmit={handleAddSubmit} className="mt-6">
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Nome de exibição<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Rede <span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <select
                  data-testid="wallet-network-select"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="polygon">Polygon</option>
                  <option value="solana">Solana</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Endereço da carteira<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="wallet-address-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Endereço 0x da carteira"
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Tipo de carteira<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as WalletProvider)}
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="metamask">MetaMask</option>
                  <option value="coinbase">Coinbase Wallet</option>
                  <option value="rainbow">Rainbow</option>
                  <option value="walletconnect">WalletConnect</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  E-mail<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-surface-raised/40 px-3 text-xs text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Apelido da carteira<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  data-testid="wallet-label-input"
                  value={walletLabel}
                  onChange={(e) => setWalletLabel(e.target.value)}
                  placeholder="Ex: Carteira Pessoal"
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Nome do perfil<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  ENS ou carteira secundária (opcional)
                </label>
                <input
                  type="text"
                  value={secondaryAddress}
                  onChange={(e) => setSecondaryAddress(e.target.value)}
                  placeholder="ENS ou carteira secundária (opcional)"
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Código de indicação<span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Código de indicação"
                  className="mt-1 h-10 w-full rounded-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Nome ENS <span className="text-primary font-bold ml-0.5">*</span>
                </label>
                <div className="mt-1 flex">
                  <div className="flex items-center gap-1 border border-r-0 border-border-soft bg-surface-raised px-2.5 text-xs text-foreground rounded-l-md">
                    <span>.eth</span>
                    <span className="text-[10px] text-muted-foreground">▼</span>
                  </div>
                  <input
                    type="text"
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    placeholder="nome.eth"
                    className="h-10 w-full rounded-r-md border border-border-soft bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              data-testid="submit-add-wallet-btn"
              disabled={addMutation.isPending}
              className="rounded-md bg-primary px-7 py-2.5 font-mono text-xs font-bold text-primary-foreground shadow transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            >
              {addMutation.isPending ? 'Salvando...' : 'Salvar carteira'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-10 border-t border-border-soft/60 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            Carteira secundária
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <span className="size-3.5 rounded-full border border-border-soft" />
              <span>Igual à carteira principal</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAddress('0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''))
              }}
              className="text-primary font-semibold hover:underline"
            >
              Adicionar
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Você ainda não adicionou uma carteira secundária.
        </p>
      </div>

      <div className="mt-10 border-t border-border-soft/60 pt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Carteiras vinculadas ({wallets.length})
        </h3>

        <div className="space-y-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              data-testid={`wallet-card-${wallet.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-card p-4 transition"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-surface-raised border border-border-soft text-primary">
                  <WalletIcon className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {wallet.label || 'Carteira'}
                    </span>
                    {wallet.isPrimary && (
                      <span
                        data-testid={`primary-badge-${wallet.id}`}
                        className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary"
                      >
                        Principal
                      </span>
                    )}
                  </div>
                  <span
                    data-testid={`wallet-address-${wallet.id}`}
                    className="font-mono text-[11px] text-muted-foreground"
                  >
                    {wallet.address}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!wallet.isPrimary && (
                  <button
                    type="button"
                    data-testid={`set-primary-btn-${wallet.id}`}
                    onClick={() => setPrimaryMutation.mutate(wallet.id)}
                    className="rounded border border-border-soft px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-foreground transition"
                  >
                    Tornar principal
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`remove-wallet-btn-${wallet.id}`}
                  onClick={() => removeMutation.mutate(wallet.id)}
                  className="rounded border border-border-soft px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground hover:border-destructive hover:text-destructive transition"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


type OrdersHistoryProps = {
  orders: Order[]
  isLoading: boolean
  statusFilter: 'all' | OrderStatus
  onStatusFilterChange: (status: 'all' | OrderStatus) => void
  onRefetch: () => void
}

function OrdersHistorySection({
  orders,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onRefetch,
}: OrdersHistoryProps) {
  return (
    <section aria-labelledby="orders-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-4 mb-6">
        <div>
          <h2 id="orders-heading" className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Atividade de Pedidos
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Acompanhe o estado de todas as suas compras e acesse os recibos oficiais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="filter-all"
            onClick={() => onStatusFilterChange('all')}
            className={`rounded px-3 py-1 font-mono text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border-soft bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            data-testid="filter-confirmed"
            onClick={() => onStatusFilterChange('confirmed')}
            className={`rounded px-3 py-1 font-mono text-xs font-semibold transition ${
              statusFilter === 'confirmed'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border-soft bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            Confirmados
          </button>
          <button
            type="button"
            data-testid="filter-pending"
            onClick={() => onStatusFilterChange('pending')}
            className={`rounded px-3 py-1 font-mono text-xs font-semibold transition ${
              statusFilter === 'pending'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border-soft bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            Pendentes
          </button>
          <button
            type="button"
            data-testid="filter-declined"
            onClick={() => onStatusFilterChange('declined')}
            className={`rounded px-3 py-1 font-mono text-xs font-semibold transition ${
              statusFilter === 'declined'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border-soft bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            Recusados
          </button>
          <button
            type="button"
            onClick={onRefetch}
            aria-label="Atualizar pedidos"
            title="Atualizar lista"
            className="rounded border border-border-soft bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground transition hover:text-foreground"
          >
            ↻
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-28 w-full animate-pulse rounded-xl bg-card" />
          <div className="h-28 w-full animate-pulse rounded-xl bg-card" />
        </div>
      ) : orders.length === 0 ? (
        <div
          data-testid="empty-orders-view"
          className="rounded-2xl border border-dashed border-border-soft bg-card p-10 text-center"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-raised font-mono text-xl text-primary">
            ⌕
          </div>
          <h3 className="mt-3 font-mono text-base font-bold text-foreground">
            Nenhum pedido encontrado
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Você ainda não possui transações registradas com este filtro de status.
          </p>
          <Link
            to="/"
            search={{ q: '', collection: 'all', available: false, sort: 'newest', minPrice: 0.02, maxPrice: 12.3, network: 'all', page: 1 }}
            className="mt-4 inline-flex items-center rounded bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground hover:bg-primary-light transition-colors"
          >
            Explorar Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              data-testid={`order-card-${order.id}`}
              className="rounded-xl border border-border-soft bg-card p-5 shadow-sm transition hover:border-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3 text-xs">
                <div>
                  <span className="font-mono text-muted-foreground">Identificador: </span>
                  <strong className="font-mono text-foreground">{order.id}</strong>
                </div>

                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} orderId={order.id} />
                  <Link
                    to="/pedidos/$orderId"
                    params={{ orderId: order.id }}
                    data-testid={`view-receipt-${order.id}`}
                    className="font-mono text-xs font-bold text-primary hover:underline"
                  >
                    Ver recibo →
                  </Link>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {order.items[0]?.imageUrl && (
                    <img
                      src={order.items[0].imageUrl}
                      alt={order.items[0].name}
                      className="size-12 rounded object-cover bg-surface-raised"
                    />
                  )}
                  <div>
                    <h4 className="font-mono text-xs font-bold text-foreground">
                      {order.items[0]?.name ?? 'Item do pedido'}
                      {order.items.length > 1 && ` +${order.items.length - 1} obras`}
                    </h4>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Comprador: {order.buyer.name} · Rede: {order.buyer.network}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-[10px] text-muted-foreground">Valor total:</span>
                  <p className="font-mono text-sm font-bold text-primary" data-testid={`order-total-${order.id}`}>
                    {formatEth(order.totalEth)} ETH
                  </p>
                </div>
              </div>

              {order.status === 'declined' && order.declineReason && (
                <div className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
                  Motivo da recusa: {order.declineReason}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function OrderStatusBadge({ status, orderId }: { status: OrderStatus; orderId: string }) {
  if (status === 'confirmed') {
    return (
      <span
        data-testid={`order-status-${orderId}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-success"
      >
        <span className="size-1.5 rounded-full bg-success" />
        Confirmado
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span
        data-testid={`order-status-${orderId}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-warning"
      >
        <span className="size-1.5 rounded-full bg-warning animate-pulse" />
        Pendente
      </span>
    )
  }
  return (
    <span
      data-testid={`order-status-${orderId}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive"
    >
      <span className="size-1.5 rounded-full bg-destructive" />
      Recusado
    </span>
  )
}


function UserIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function WalletIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M16 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z" fill="currentColor" />
    </svg>
  )
}

function ActivityCartIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

function HeartOutlineIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function TrendingIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function DownloadIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function HelpIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function LogoutIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function AvatarPlaceholderIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function EyeSlashIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function FavoritesCollectorView({
  favoriteIds,
  onToggleFavorite,
}: {
  favoriteIds: string[]
  onToggleFavorite: (nft: { id: string; name?: string }) => Promise<void>
}) {
  const nftsQuery = useQuery({
    queryKey: ['nfts', 'favorites-list', favoriteIds],
    queryFn: async ({ signal }) => {
      if (favoriteIds.length === 0) return []
      const response = await http.get<NftListResponse>('/api/nfts', {
        signal,
        params: { pageSize: 100 },
      })
      const map = new Map<string, NftListItem>()
      for (const item of response.data.items) {
        map.set(item.id, item)
      }
      const missingIds = favoriteIds.filter((id) => !map.has(id))
      if (missingIds.length > 0) {
        await Promise.all(
          missingIds.map(async (id) => {
            try {
              const nft = await getNft(id, signal)
              const pricedEditions = [...nft.editions].sort((a, b) => Number(a.priceEth) - Number(b.priceEth))
              const availableEditions = pricedEditions.filter((e) => e.available > 0)
              const lowest = availableEditions[0] ?? pricedEditions[0]
              map.set(nft.id, {
                ...nft,
                priceEth: lowest?.priceEth ?? '0',
                available: nft.editions.reduce((total, e) => total + e.available, 0),
                availableEditionCount: availableEditions.length,
              })
            } catch {
              void 0
            }
          }),
        )
      }
      return favoriteIds.map((id) => map.get(id)).filter((item): item is NftListItem => Boolean(item))
    },
    staleTime: 5_000,
  })

  const favoriteNfts = nftsQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-mono text-xl font-bold text-foreground">Lista de interesse</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Obras digitais que você favoritou e está acompanhando na Kurio Marketplace.
        </p>
      </div>

      {nftsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-shimmer rounded-xl bg-surface-raised" />
          ))}
        </div>
      ) : favoriteNfts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-raised text-primary">
            <HeartOutlineIcon className="size-6" />
          </div>
          <h3 className="mt-3 font-mono text-base font-bold text-foreground">
            Sua lista de interesses está vazia
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground max-w-sm mx-auto">
            Navegue pelo catálogo e clique no ícone de coração para salvar suas obras favoritas aqui.
          </p>
          <Link
            to="/"
            search={catalogSearchDefaults}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 font-mono text-xs font-bold text-primary-foreground hover:bg-primary-light transition"
          >
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {favoriteNfts.map((nft: NftListItem) => (
            <article
              key={nft.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
                <img
                  src={nft.imageUrl}
                  alt={nft.name}
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(nft)}
                  aria-label={`Remover ${nft.name} dos favoritos`}
                  className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-primary backdrop-blur-sm transition hover:scale-110"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>

              <div className="p-3">
                <p className="font-mono text-[10px] text-muted-foreground truncate">{nft.collection.name}</p>
                <h4 className="font-mono text-xs font-bold text-foreground truncate mt-0.5">{nft.name}</h4>
                <div className="mt-2.5 flex items-center justify-between border-t border-border-soft pt-2">
                  <span className="font-mono text-xs font-bold text-primary tabular-nums">
                    {formatEth(nft.priceEth)} ETH
                  </span>
                  <Link
                    to="/nfts/$nftId"
                    params={{ nftId: nft.id }}
                    className="font-mono text-[11px] font-semibold text-primary hover:underline"
                  >
                    Ver detalhes →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
