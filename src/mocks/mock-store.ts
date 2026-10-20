import type {
  AddWalletPayload,
  CartCoupon,
  CartItem,
  CartQuote,
  CartQuoteConflict,
  CartResponse,
  CreateOrderPayload,
  MergeCartResponse,
  Order,
  OrderItem,
  OrderStatus,
  UpdateProfilePayload,
  User,
  Wallet,
} from './contracts'
import { nftFixtures, resetNftFixtures, updateNftFixture } from './fixtures/nfts'
import { addEth, calculateDiscountEth, multiplyEth, subtractEth } from '@/lib/eth-currency'

type StoredUser = User & {
  passwordHash: string
}

type StoredSession = {
  token: string
  userId: string
  expiresAt: number
}

type StoredCartItem = {
  id: string // `${nftId}:${editionId}`
  nftId: string
  editionId: string
  quantity: number
  addedPriceEth: string
}

type StoredCart = {
  items: StoredCartItem[]
  couponCode: string | null
}

export type NftOverride = {
  priceEth?: string
  available?: number
  editionId?: string
  version?: number
}

type IdempotencyRecord = {
  orderId: string
  payloadFingerprint: string
}

type MockStoreState = {
  users: StoredUser[]
  sessions: StoredSession[]
  favorites: Record<string, string[]>
  carts: Record<string, StoredCart>
  orders: Record<string, Order>
  wallets: Record<string, Wallet[]>
  idempotencyRecords: Record<string, IdempotencyRecord>
  nftOverrides?: Record<string, NftOverride>
  scenarios: {
    failNextNftListRequest: boolean
    failNextFavoriteRequest: boolean
    forceSessionExpired: boolean
    failNextQuoteRequest: boolean
    failNextOrderCreate: boolean
    timeoutAfterOrderCreate: boolean
    nextPaymentResult: OrderStatus | null
    failNextAccountRequest: boolean
    failNextWalletRequest: boolean
  }
}

const STORAGE_KEY = 'nft_mock_store_v1'


export function mockHashPassword(password: string): string {
  if (!password) return ''
  let hash = 0x811c9dc5
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `argon2_sim_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const initialUsers: StoredUser[] = [
  {
    id: 'user-ana',
    name: 'Ana Silva',
    email: 'ana@exemplo.com',
    passwordHash: mockHashPassword('Password123!'),
    avatarUrl: '/avatars/ana.png',
    bio: 'Colecionadora de arte generativa e fotografia abstrata.',
  },
  {
    id: 'user-lucas',
    name: 'Lucas Costa',
    email: 'lucas@exemplo.com',
    passwordHash: mockHashPassword('Password123!'),
    avatarUrl: '/avatars/lucas.png',
    bio: 'Entusiasta Web3 e investidor em edições raras.',
  },
]

const initialFavorites: Record<string, string[]> = {
  'user-ana': ['nft-aurora-017'],
  'user-lucas': ['nft-flora-006'],
}

const initialWallets: Record<string, Wallet[]> = {
  'user-ana': [
    {
      id: 'w-ana-1',
      userId: 'user-ana',
      address: '0x71C8564E3b3026D327732168434757342898a49B',
      label: 'MetaMask Principal',
      provider: 'metamask',
      isPrimary: true,
      createdAt: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'w-ana-2',
      userId: 'user-ana',
      address: '0xC01ba472B3c114d79124233fB22964177a4F2290',
      label: 'Coinbase Vault',
      provider: 'coinbase',
      isPrimary: false,
      createdAt: '2026-02-01T14:30:00.000Z',
    },
  ],
  'user-lucas': [
    {
      id: 'w-lucas-1',
      userId: 'user-lucas',
      address: '0x8A2c89452817342918451834190823419845e190',
      label: 'Rainbow Lucas',
      provider: 'rainbow',
      isPrimary: true,
      createdAt: '2026-01-20T12:00:00.000Z',
    },
  ],
}

function computeOrderFingerprint(payload: CreateOrderPayload): string {
  const sortedItems = [...payload.items]
    .sort((a, b) => `${a.nftId}:${a.editionId}`.localeCompare(`${b.nftId}:${b.editionId}`))
    .map((i) => `${i.nftId}:${i.editionId}:${i.quantity}:${i.unitPriceEth}`)
    .join('|')
  return `${payload.buyer.name}|${payload.buyer.email}|${payload.buyer.walletAddress}|${payload.buyer.network}|${sortedItems}|${payload.totalEth}|${payload.couponCode ?? ''}`
}

function createInitialState(): MockStoreState {
  return {
    users: initialUsers.map((u) => ({ ...u })),
    sessions: [
      {
        token: 'tok-user-ana-preset',
        userId: 'user-ana',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    ],
    favorites: Object.fromEntries(
      Object.entries(initialFavorites).map(([k, v]) => [k, [...v]]),
    ),
    carts: {},
    orders: {},
    wallets: Object.fromEntries(
      Object.entries(initialWallets).map(([k, v]) => [k, v.map((w) => ({ ...w }))]),
    ),
    idempotencyRecords: {},
    nftOverrides: {},
    scenarios: {
      failNextNftListRequest: false,
      failNextFavoriteRequest: false,
      forceSessionExpired: false,
      failNextQuoteRequest: false,
      failNextOrderCreate: false,
      timeoutAfterOrderCreate: false,
      nextPaymentResult: null,
      failNextAccountRequest: false,
      failNextWalletRequest: false,
    },
  }
}


class MockStore {
  private state: MockStoreState

  constructor() {
    this.state = this.loadFromStorage() ?? createInitialState()
    this.applyNftOverrides()
  }

  private applyNftOverrides(): void {
    if (!this.state.nftOverrides) return
    for (const [nftId, override] of Object.entries(this.state.nftOverrides)) {
      updateNftFixture(nftId, override)
    }
  }

  public setNftOverride(nftId: string, override: NftOverride): void {
    if (!this.state.nftOverrides) {
      this.state.nftOverrides = {}
    }
    this.state.nftOverrides[nftId] = {
      ...(this.state.nftOverrides[nftId] ?? {}),
      ...override,
    }
    this.saveToStorage()
  }

  private loadFromStorage(): MockStoreState | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as MockStoreState
      if (!parsed.orders) parsed.orders = {}
      if (!parsed.wallets) parsed.wallets = { ...initialWallets }
      if (!parsed.idempotencyRecords) parsed.idempotencyRecords = {}
      if (!parsed.scenarios) {
        parsed.scenarios = createInitialState().scenarios
      }
      if (parsed.scenarios.failNextAccountRequest === undefined) {
        parsed.scenarios.failNextAccountRequest = false
      }
      if (parsed.scenarios.failNextWalletRequest === undefined) {
        parsed.scenarios.failNextWalletRequest = false
      }
      if (parsed.users) {
        for (const u of parsed.users) {
          if (u.passwordHash && !u.passwordHash.startsWith('argon2_sim_')) {
            u.passwordHash = mockHashPassword(u.passwordHash)
          }
        }
      }
      return parsed
    } catch {
      return null
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch  {
      void 0
    }
  }

  public reset(): void {
    resetNftFixtures()
    this.state = createInitialState()
    this.saveToStorage()
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase()
    return this.state.users.find((u) => u.email.toLowerCase() === normalized)
  }

  private toPublicUser(user: StoredUser): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    }
  }

  public findUserById(id: string): User | undefined {
    const user = this.state.users.find((u) => u.id === id)
    if (!user) return undefined
    return this.toPublicUser(user)
  }

  public registerUser(name: string, email: string, passwordInput: string): { user: User; token: string } {
    const normalized = email.trim().toLowerCase()
    if (this.findUserByEmail(normalized)) {
      throw new Error('E-mail já cadastrado.')
    }

    const newUser: StoredUser = {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: normalized,
      passwordHash: mockHashPassword(passwordInput),
    }

    this.state.users.push(newUser)
    this.state.favorites[newUser.id] = []

    const session = this.createSession(newUser.id)
    this.saveToStorage()

    return { user: this.toPublicUser(newUser), token: session.token }
  }

  public validateCredentials(email: string, password: string): { user: User; token: string } | null {
    const user = this.findUserByEmail(email)
    const expectedHash = mockHashPassword(password)
    if (!user) return null

    if (user.passwordHash !== expectedHash && user.passwordHash !== password) {
      return null
    }

    if (user.passwordHash === password) {
      user.passwordHash = expectedHash
    }

    const session = this.createSession(user.id)
    this.saveToStorage()

    return { user: this.toPublicUser(user), token: session.token }
  }

  public createSession(userId: string): StoredSession {
    this.state.scenarios.forceSessionExpired = false
    const session: StoredSession = {
      token: `tok-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    }
    this.state.sessions = this.state.sessions.filter((s) => s.userId !== userId)
    this.state.sessions.push(session)
    this.saveToStorage()
    return session
  }

  public getSession(token: string): { user: User; expired: boolean } | null {
    if (this.state.scenarios.forceSessionExpired) {
      this.state.scenarios.forceSessionExpired = false
      this.saveToStorage()
      const fallbackUser: User = {
        id: 'user-ana',
        name: 'Ana Silva',
        email: 'ana@exemplo.com',
      }
      return { user: this.findUserById('user-ana') ?? fallbackUser, expired: true }
    }

    const session = this.state.sessions.find((s) => s.token === token)
    if (!session) return null

    const user = this.findUserById(session.userId)
    if (!user) return null

    const isExpired = Date.now() > session.expiresAt
    return { user, expired: isExpired }
  }

  public deleteSession(token: string): void {
    this.state.sessions = this.state.sessions.filter((s) => s.token !== token)
    this.saveToStorage()
  }

  public getUserFavorites(userId: string): string[] {
    return this.state.favorites[userId] ?? []
  }

  public addFavorite(userId: string, nftId: string): string[] {
    const current = this.state.favorites[userId] ?? []
    if (!current.includes(nftId)) {
      this.state.favorites[userId] = [...current, nftId]
      this.saveToStorage()
    }
    return this.state.favorites[userId] ?? []
  }

  public removeFavorite(userId: string, nftId: string): string[] {
    const current = this.state.favorites[userId] ?? []
    this.state.favorites[userId] = current.filter((id) => id !== nftId)
    this.saveToStorage()
    return this.state.favorites[userId] ?? []
  }



  private getRawCart(ownerId: string): StoredCart {
    if (!this.state.carts) {
      this.state.carts = {}
    }
    if (!this.state.carts[ownerId]) {
      this.state.carts[ownerId] = { items: [], couponCode: null }
    }
    return this.state.carts[ownerId]
  }

  private resolveCoupon(code: string | null, subtotalEth: string): CartCoupon | null {
    if (!code) return null
    const normalized = code.trim().toUpperCase()
    const discountPercent =
      normalized === 'PROMO10' ? 10 : normalized === 'CRYPTO20' ? 20 : normalized === 'KURIO5' ? 5 : null

    if (discountPercent === null) return null

    const discountEth = calculateDiscountEth(subtotalEth, discountPercent)
    return {
      code: normalized,
      discountPercent,
      discountEth,
    }
  }

  private mapStoredItems(storedItems: StoredCartItem[]): CartItem[] {
    const result: CartItem[] = []

    for (const item of storedItems) {
      const nft = nftFixtures.find((n) => n.id === item.nftId)
      if (!nft) continue

      const edition = nft.editions.find((e) => e.id === item.editionId) ?? nft.editions[0]
      if (!edition) continue

      const priceChanged = edition.priceEth !== item.addedPriceEth
      const stockChanged = item.quantity > edition.available
      const subtotalEth = multiplyEth(edition.priceEth, item.quantity)

      result.push({
        id: item.id,
        nftId: item.nftId,
        editionId: item.editionId,
        name: nft.name,
        collectionName: nft.collection.name,
        imageUrl: nft.imageUrl,
        editionName: edition.name,
        editionNumber: edition.editionNumber,
        unitPriceEth: edition.priceEth,
        quantity: item.quantity,
        available: edition.available,
        subtotalEth,
        priceChanged,
        stockChanged,
        originalPriceEth: priceChanged ? item.addedPriceEth : undefined,
        originalAvailable: edition.available,
      })
    }

    return result
  }

  public getCart(ownerId: string): CartResponse {
    const rawCart = this.getRawCart(ownerId)
    const items = this.mapStoredItems(rawCart.items)
    const subtotalEth = addEth(...items.map((i) => i.subtotalEth))
    const coupon = this.resolveCoupon(rawCart.couponCode, subtotalEth)

    return {
      items,
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      coupon,
    }
  }

  public addToCart(
    ownerId: string,
    payload: { nftId: string; editionId?: string; quantity?: number },
  ): CartResponse {
    const rawCart = this.getRawCart(ownerId)
    const nft = nftFixtures.find((n) => n.id === payload.nftId)
    if (!nft) {
      throw new Error('NFT não encontrado.')
    }

    const editionId = payload.editionId ?? 'open'
    const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]
    if (!edition) {
      throw new Error('Edição não encontrada.')
    }

    if (edition.available <= 0) {
      throw new Error('Esta edição está esgotada.')
    }

    const requestedQuantity = Math.max(1, Math.floor(payload.quantity ?? 1))
    const itemId = `${nft.id}:${edition.id}`
    const existingIndex = rawCart.items.findIndex((item) => item.id === itemId)

    if (existingIndex >= 0) {
      const existing = rawCart.items[existingIndex]!
      const combined = existing.quantity + requestedQuantity
      existing.quantity = Math.min(combined, edition.available)
      existing.addedPriceEth = edition.priceEth
    } else {
      const allowed = Math.min(requestedQuantity, edition.available)
      rawCart.items.push({
        id: itemId,
        nftId: nft.id,
        editionId: edition.id,
        quantity: allowed,
        addedPriceEth: edition.priceEth,
      })
    }

    this.saveToStorage()
    return this.getCart(ownerId)
  }

  public updateCartItemQuantity(ownerId: string, itemId: string, quantity: number): CartResponse {
    const rawCart = this.getRawCart(ownerId)
    const itemIndex = rawCart.items.findIndex((i) => i.id === itemId)
    if (itemIndex < 0) {
      throw new Error('Item não encontrado no carrinho.')
    }

    const item = rawCart.items[itemIndex]!
    const nft = nftFixtures.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId) ?? nft?.editions[0]
    const maxAvailable = edition?.available ?? 0

    const intQty = Math.floor(quantity)
    if (intQty <= 0) {
      rawCart.items.splice(itemIndex, 1)
    } else {
      item.quantity = Math.min(intQty, maxAvailable > 0 ? maxAvailable : intQty)
      if (edition) {
        item.addedPriceEth = edition.priceEth
      }
    }

    this.saveToStorage()
    return this.getCart(ownerId)
  }

  public removeFromCart(ownerId: string, itemId: string): CartResponse {
    const rawCart = this.getRawCart(ownerId)
    rawCart.items = rawCart.items.filter((i) => i.id !== itemId)
    this.saveToStorage()
    return this.getCart(ownerId)
  }

  public clearCart(ownerId: string): CartResponse {
    this.state.carts[ownerId] = { items: [], couponCode: null }
    this.saveToStorage()
    return this.getCart(ownerId)
  }

  public applyCoupon(ownerId: string, code: string): { coupon: CartCoupon } {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      throw new Error('Informe um código de cupom.')
    }
    if (normalized === 'EXPIRED50') {
      throw new Error('Cupom expirado.')
    }
    if (!['PROMO10', 'CRYPTO20', 'KURIO5'].includes(normalized)) {
      throw new Error('Cupom inválido.')
    }

    const rawCart = this.getRawCart(ownerId)
    rawCart.couponCode = normalized
    this.saveToStorage()

    const cart = this.getCart(ownerId)
    if (!cart.coupon) {
      throw new Error('Não foi possível aplicar o cupom.')
    }
    return { coupon: cart.coupon }
  }

  public removeCoupon(ownerId: string): CartResponse {
    const rawCart = this.getRawCart(ownerId)
    rawCart.couponCode = null
    this.saveToStorage()
    return this.getCart(ownerId)
  }

  public getQuote(ownerId: string): CartQuote {
    if (this.checkAndConsumeFailNextQuote()) {
      throw new Error('Falha ao calcular cotação.')
    }

    const rawCart = this.getRawCart(ownerId)
    const items = this.mapStoredItems(rawCart.items)
    const subtotalEth = addEth(...items.map((i) => i.subtotalEth))
    const coupon = this.resolveCoupon(rawCart.couponCode, subtotalEth)
    const discountEth = coupon?.discountEth ?? '0'
    const networkFeeEth = items.length > 0 ? '0.0025' : '0'
    const totalEth = items.length > 0 ? addEth(subtractEth(subtotalEth, discountEth), networkFeeEth) : '0'

    const conflicts: CartQuoteConflict[] = []
    for (const item of items) {
      if (item.available === 0) {
        conflicts.push({
          type: 'item_unavailable',
          nftId: item.nftId,
          editionId: item.editionId,
          message: `${item.name} (${item.editionName}) está esgotado.`,
        })
      } else if (item.stockChanged) {
        conflicts.push({
          type: 'stock_exceeded',
          nftId: item.nftId,
          editionId: item.editionId,
          message: `A quantidade de ${item.name} excede o estoque disponível (${item.available}).`,
        })
      }
      if (item.priceChanged) {
        conflicts.push({
          type: 'price_changed',
          nftId: item.nftId,
          editionId: item.editionId,
          message: `O preço de ${item.name} foi atualizado para ${item.unitPriceEth} ETH.`,
        })
      }
    }

    return {
      id: `quote-${ownerId}-${Date.now().toString(36)}`,
      items,
      subtotalEth,
      discountEth,
      networkFeeEth,
      totalEth,
      coupon,
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      isValid: conflicts.length === 0,
      conflicts,
    }
  }

  public mergeCarts(targetOwnerId: string, sourceGuestId: string): MergeCartResponse {
    if (!sourceGuestId || sourceGuestId === targetOwnerId) {
      return { success: true, items: this.getCart(targetOwnerId).items, conflicts: [] }
    }

    const sourceRaw = this.state.carts?.[sourceGuestId]
    if (!sourceRaw || sourceRaw.items.length === 0) {
      return { success: true, items: this.getCart(targetOwnerId).items, conflicts: [] }
    }

    const targetRaw = this.getRawCart(targetOwnerId)
    const conflicts: CartQuoteConflict[] = []

    for (const sourceItem of sourceRaw.items) {
      const nft = nftFixtures.find((n) => n.id === sourceItem.nftId)
      const edition = nft?.editions.find((e) => e.id === sourceItem.editionId) ?? nft?.editions[0]
      const available = edition?.available ?? 0

      const targetExisting = targetRaw.items.find((i) => i.id === sourceItem.id)

      if (targetExisting) {
        const combined = targetExisting.quantity + sourceItem.quantity
        if (combined > available) {
          targetExisting.quantity = Math.max(1, available)
          conflicts.push({
            type: 'stock_exceeded',
            nftId: sourceItem.nftId,
            editionId: sourceItem.editionId,
            message: `A quantidade combinada de ${nft?.name ?? sourceItem.nftId} excedeu o estoque e foi limitada a ${targetExisting.quantity}.`,
          })
        } else {
          targetExisting.quantity = combined
        }
        if (edition && edition.priceEth !== targetExisting.addedPriceEth) {
          targetExisting.addedPriceEth = edition.priceEth
          conflicts.push({
            type: 'price_changed',
            nftId: sourceItem.nftId,
            editionId: sourceItem.editionId,
            message: `O preço de ${nft?.name ?? sourceItem.nftId} mudou para ${edition.priceEth} ETH.`,
          })
        }
      } else {
        let quantity = sourceItem.quantity
        if (quantity > available) {
          quantity = Math.max(1, available)
          conflicts.push({
            type: 'stock_exceeded',
            nftId: sourceItem.nftId,
            editionId: sourceItem.editionId,
            message: `A quantidade de ${nft?.name ?? sourceItem.nftId} excedeu o estoque e foi limitada a ${quantity}.`,
          })
        }
        targetRaw.items.push({
          ...sourceItem,
          quantity,
          addedPriceEth: edition?.priceEth ?? sourceItem.addedPriceEth,
        })
        if (edition && edition.priceEth !== sourceItem.addedPriceEth) {
          conflicts.push({
            type: 'price_changed',
            nftId: sourceItem.nftId,
            editionId: sourceItem.editionId,
            message: `O preço de ${nft?.name ?? sourceItem.nftId} mudou para ${edition.priceEth} ETH.`,
          })
        }
      }
    }

    if (!targetRaw.couponCode && sourceRaw.couponCode) {
      targetRaw.couponCode = sourceRaw.couponCode
    }

    delete this.state.carts[sourceGuestId]
    this.saveToStorage()

    return {
      success: true,
      items: this.getCart(targetOwnerId).items,
      conflicts,
    }
  }



  public setForceSessionExpired(force: boolean): void {
    this.state.scenarios.forceSessionExpired = force
    this.saveToStorage()
  }

  public setFailNextFavorite(fail: boolean): void {
    this.state.scenarios.failNextFavoriteRequest = fail
    this.saveToStorage()
  }

  public checkAndConsumeFailNextFavorite(): boolean {
    if (this.state.scenarios.failNextFavoriteRequest) {
      this.state.scenarios.failNextFavoriteRequest = false
      this.saveToStorage()
      return true
    }
    return false
  }

  public setFailNextNftList(fail: boolean): void {
    this.state.scenarios.failNextNftListRequest = fail
    this.saveToStorage()
  }

  public checkAndConsumeFailNextNftList(): boolean {
    if (this.state.scenarios.failNextNftListRequest) {
      this.state.scenarios.failNextNftListRequest = false
      this.saveToStorage()
      return true
    }
    return false
  }

  public setFailNextQuote(fail: boolean): void {
    this.state.scenarios.failNextQuoteRequest = fail
    this.saveToStorage()
  }

  public checkAndConsumeFailNextQuote(): boolean {
    if (this.state.scenarios.failNextQuoteRequest) {
      this.state.scenarios.failNextQuoteRequest = false
      this.saveToStorage()
      return true
    }
    return false
  }



  public createOrder(userId: string, payload: CreateOrderPayload, idempotencyKey: string): Order {
    if (this.state.scenarios.failNextOrderCreate) {
      this.state.scenarios.failNextOrderCreate = false
      this.saveToStorage()
      throw new Error('FALHA_CRIACAO_PEDIDO: Serviço temporariamente indisponível.')
    }

    const key = (idempotencyKey || payload.idempotencyKey || '').trim()
    if (!key) {
      throw new Error('Chave de idempotência é obrigatória.')
    }

    const fingerprint = computeOrderFingerprint(payload)
    if (!this.state.orders) this.state.orders = {}
    if (!this.state.idempotencyRecords) this.state.idempotencyRecords = {}

    const existingRecord = this.state.idempotencyRecords[key]
    if (existingRecord) {
      if (existingRecord.payloadFingerprint === fingerprint) {
        const existingOrder = this.state.orders[existingRecord.orderId]
        if (existingOrder) {
          return existingOrder
        }
      } else {
        throw new Error('IDEMPOTENCY_CONFLICT: Chave de idempotência já utilizada com payload diferente.')
      }
    }


    for (const item of payload.items) {
      const nft = nftFixtures.find((n) => n.id === item.nftId)
      if (!nft) {
        throw new Error(`CONFLITO_PEDIDO: NFT "${item.nftId}" não encontrado.`)
      }
      const edition = nft.editions.find((e) => e.id === item.editionId) ?? nft.editions[0]
      if (!edition) {
        throw new Error(`CONFLITO_PEDIDO: Edição "${item.editionId}" não encontrada.`)
      }
      if (edition.available <= 0) {
        throw new Error(`ITEM_ESGOTADO: A obra "${nft.name}" está esgotada.`)
      }
      if (edition.available < item.quantity) {
        throw new Error(
          `ESTOQUE_ALTERADO: Quantidade solicitada de "${nft.name}" excede estoque disponível (${edition.available}).`,
        )
      }
      if (edition.priceEth !== item.unitPriceEth) {
        throw new Error(
          `PRECO_ALTERADO: O preço de "${nft.name}" foi alterado de ${item.unitPriceEth} ETH para ${edition.priceEth} ETH.`,
        )
      }
    }

    const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const orderItems: OrderItem[] = payload.items.map((pi) => {
      const nft = nftFixtures.find((n) => n.id === pi.nftId)
      const edition = nft?.editions.find((e) => e.id === pi.editionId) ?? nft?.editions[0]
      return {
        id: `${pi.nftId}:${pi.editionId}`,
        nftId: pi.nftId,
        editionId: pi.editionId,
        name: nft?.name ?? pi.nftId,
        collectionName: nft?.collection.name ?? '',
        imageUrl: nft?.imageUrl ?? '',
        editionName: edition?.name ?? 'Standard',
        editionNumber: edition?.editionNumber ?? '#01',
        unitPriceEth: pi.unitPriceEth,
        quantity: pi.quantity,
        subtotalEth: multiplyEth(pi.unitPriceEth, pi.quantity),
      }
    })

    const coupon = payload.couponCode ? this.resolveCoupon(payload.couponCode, payload.subtotalEth) : null

    const newOrder: Order = {
      id: orderId,
      idempotencyKey: key,
      userId,
      buyer: payload.buyer,
      items: orderItems,
      subtotalEth: payload.subtotalEth,
      discountEth: payload.discountEth,
      networkFeeEth: payload.networkFeeEth,
      totalEth: payload.totalEth,
      coupon,
      status: 'pending',
      createdAt: new Date().toISOString(),
      version: 1,
    }

    this.state.orders[orderId] = newOrder
    this.state.idempotencyRecords[key] = {
      orderId,
      payloadFingerprint: fingerprint,
    }
    this.saveToStorage()


    if (this.state.scenarios.timeoutAfterOrderCreate) {
      this.state.scenarios.timeoutAfterOrderCreate = false
      this.saveToStorage()
      throw new Error('TIMEOUT_AFTER_CREATE')
    }

    return newOrder
  }

  public getOrder(orderId: string): Order | null {
    if (!this.state.orders) this.state.orders = {}
    if (this.state.orders[orderId]) {
      return this.state.orders[orderId]!
    }
    const reloaded = this.loadFromStorage()
    if (reloaded?.orders?.[orderId]) {
      this.state.orders[orderId] = reloaded.orders[orderId]!
      return reloaded.orders[orderId]!
    }
    return null
  }

  public simulatePayment(orderId: string, action?: 'confirm' | 'decline' | 'pending'): Order {
    if (!this.state.orders) this.state.orders = {}
    let order = this.state.orders[orderId]
    if (!order) {
      const reloaded = this.loadFromStorage()
      if (reloaded?.orders?.[orderId]) {
        this.state.orders[orderId] = reloaded.orders[orderId]!
        order = reloaded.orders[orderId]!
      }
    }
    if (!order) {
      throw new Error('Pedido não encontrado.')
    }

    const outcome = action ?? this.state.scenarios.nextPaymentResult ?? 'confirmed'
    this.state.scenarios.nextPaymentResult = null

    if (outcome === 'confirmed') {
      order.status = 'confirmed'
      order.confirmedAt = new Date().toISOString()
      order.transactionHash =
        '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      order.version += 1


      for (const item of order.items) {
        const nft = nftFixtures.find((n) => n.id === item.nftId)
        if (nft) {
          const edition = nft.editions.find((e) => e.id === item.editionId) ?? nft.editions[0]
          if (edition) {
            edition.available = Math.max(0, edition.available - item.quantity)
            this.setNftOverride(item.nftId, {
              available: edition.available,
              editionId: edition.id,
              version: (nft.version || 1) + 1,
            })
          }
        }
      }


      const rawCart = this.state.carts?.[order.userId]
      if (rawCart) {
        for (const item of order.items) {
          const cartItemIndex = rawCart.items.findIndex(
            (ci) => ci.nftId === item.nftId && ci.editionId === item.editionId,
          )
          if (cartItemIndex >= 0) {
            const cartItem = rawCart.items[cartItemIndex]!
            if (cartItem.quantity <= item.quantity) {
              rawCart.items.splice(cartItemIndex, 1)
            } else {
              cartItem.quantity -= item.quantity
            }
          }
        }
        if (rawCart.items.length === 0) {
          rawCart.couponCode = null
        }
      }

      this.saveToStorage()
      return order
    }

    if (outcome === 'declined') {
      order.status = 'declined'
      order.declineReason = 'Simulação de pagamento recusada pela carteira.'
      order.version += 1
      this.saveToStorage()
      return order
    }


    order.status = 'pending'
    this.saveToStorage()
    return order
  }

  public updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    transactionHash?: string,
    declineReason?: string,
  ): Order | undefined {
    const order = this.state.orders[orderId]
    if (!order) return undefined
    order.status = status
    if (transactionHash) order.transactionHash = transactionHash
    if (declineReason) order.declineReason = declineReason
    order.version += 1
    if (status === 'confirmed') {
      const rawCart = this.state.carts?.[order.userId]
      if (rawCart) {
        for (const boughtItem of order.items) {
          const cartItemIdx = rawCart.items.findIndex(
            (ci) => ci.nftId === boughtItem.nftId && ci.editionId === boughtItem.editionId,
          )
          if (cartItemIdx >= 0) {
            const item = rawCart.items[cartItemIdx]!
            if (item.quantity <= boughtItem.quantity) {
              rawCart.items.splice(cartItemIdx, 1)
            } else {
              item.quantity -= boughtItem.quantity
            }
          }
        }
        if (rawCart.items.length === 0) {
          rawCart.couponCode = null
        }
      }
    }
    this.saveToStorage()
    return order
  }


  public updateUserProfile(userId: string, data: UpdateProfilePayload): User {
    if (this.state.scenarios.failNextAccountRequest) {
      this.state.scenarios.failNextAccountRequest = false
      this.saveToStorage()
      throw new Error('FALHA_CONTA: Erro simulado ao atualizar perfil.')
    }

    const user = this.state.users.find((u) => u.id === userId)
    if (!user) {
      throw new Error('Usuário não encontrado.')
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (trimmed.length < 2) {
        throw new Error('O nome deve conter pelo menos 2 caracteres.')
      }
      user.name = trimmed
    }

    if (data.bio !== undefined) {
      user.bio = data.bio.trim()
    }

    if (data.avatarUrl !== undefined) {
      user.avatarUrl = data.avatarUrl.trim()
    }

    this.saveToStorage()
    return this.toPublicUser(user)
  }

  public changeUserPassword(userId: string, currentPass: string, newPass: string): void {
    if (this.state.scenarios.failNextAccountRequest) {
      this.state.scenarios.failNextAccountRequest = false
      this.saveToStorage()
      throw new Error('FALHA_CONTA: Erro simulado ao alterar senha.')
    }

    const user = this.state.users.find((u) => u.id === userId)
    if (!user) {
      throw new Error('Usuário não encontrado.')
    }

    const expectedCurrentHash = mockHashPassword(currentPass)
    if (user.passwordHash !== expectedCurrentHash && user.passwordHash !== currentPass) {
      throw new Error('A senha atual informada está incorreta.')
    }

    if (!newPass || newPass.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.')
    }

    user.passwordHash = mockHashPassword(newPass)
    this.saveToStorage()
  }


  public getUserOrders(userId: string, status?: OrderStatus): Order[] {
    if (!this.state.orders) return []
    const orders = Object.values(this.state.orders).filter((o) => o.userId === userId)
    const filtered = status ? orders.filter((o) => o.status === status) : orders
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }


  public getUserWallets(userId: string): Wallet[] {
    if (!this.state.wallets) this.state.wallets = { ...initialWallets }
    return this.state.wallets[userId] ?? []
  }

  public addWallet(userId: string, payload: AddWalletPayload): Wallet {
    if (this.state.scenarios.failNextWalletRequest) {
      this.state.scenarios.failNextWalletRequest = false
      this.saveToStorage()
      throw new Error('FALHA_CARTEIRA: Erro simulado ao adicionar carteira.')
    }

    const addr = (payload.address || '').trim()
    if (!addr.startsWith('0x') || addr.length < 10) {
      throw new Error('Endereço de carteira inválido. Deve iniciar com 0x.')
    }

    if (!this.state.wallets) this.state.wallets = { ...initialWallets }
    const userWallets = this.state.wallets[userId] ?? []

    if (userWallets.some((w) => w.address.toLowerCase() === addr.toLowerCase())) {
      throw new Error('WALLET_EXISTS: Esta carteira já está vinculada à sua conta.')
    }

    const isPrimary = userWallets.length === 0 ? true : Boolean(payload.isPrimary)

    if (isPrimary) {
      for (const w of userWallets) {
        w.isPrimary = false
      }
    }

    const newWallet: Wallet = {
      id: `w-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      address: addr,
      label: payload.label?.trim() || 'Carteira Pessoal',
      provider: payload.provider ?? 'metamask',
      isPrimary,
      createdAt: new Date().toISOString(),
    }

    userWallets.push(newWallet)
    this.state.wallets[userId] = userWallets
    this.saveToStorage()
    return newWallet
  }

  public setPrimaryWallet(userId: string, walletId: string): Wallet {
    if (this.state.scenarios.failNextWalletRequest) {
      this.state.scenarios.failNextWalletRequest = false
      this.saveToStorage()
      throw new Error('FALHA_CARTEIRA: Erro simulado ao alterar carteira principal.')
    }

    if (!this.state.wallets) this.state.wallets = { ...initialWallets }
    const userWallets = this.state.wallets[userId] ?? []
    const target = userWallets.find((w) => w.id === walletId)
    if (!target) {
      throw new Error('Carteira não encontrada.')
    }

    for (const w of userWallets) {
      w.isPrimary = false
    }
    target.isPrimary = true
    this.saveToStorage()
    return target
  }

  public removeWallet(userId: string, walletId: string): boolean {
    if (this.state.scenarios.failNextWalletRequest) {
      this.state.scenarios.failNextWalletRequest = false
      this.saveToStorage()
      throw new Error('FALHA_CARTEIRA: Erro simulado ao remover carteira.')
    }

    if (!this.state.wallets) this.state.wallets = { ...initialWallets }
    const userWallets = this.state.wallets[userId] ?? []
    const target = userWallets.find((w) => w.id === walletId)
    if (!target) {
      throw new Error('Carteira não encontrada.')
    }

    if (target.isPrimary) {
      throw new Error('PRIMARY_CANNOT_BE_REMOVED: A carteira principal não pode ser removida. Defina outra carteira como principal antes de remover esta.')
    }

    this.state.wallets[userId] = userWallets.filter((w) => w.id !== walletId)
    this.saveToStorage()
    return true
  }

  public setFailNextAccount(fail: boolean): void {
    this.state.scenarios.failNextAccountRequest = fail
    this.saveToStorage()
  }

  public checkAndConsumeFailNextAccount(): boolean {
    if (this.state.scenarios.failNextAccountRequest) {
      this.state.scenarios.failNextAccountRequest = false
      this.saveToStorage()
      return true
    }
    return false
  }

  public setFailNextWallet(fail: boolean): void {
    this.state.scenarios.failNextWalletRequest = fail
    this.saveToStorage()
  }

  public checkAndConsumeFailNextWallet(): boolean {
    if (this.state.scenarios.failNextWalletRequest) {
      this.state.scenarios.failNextWalletRequest = false
      this.saveToStorage()
      return true
    }
    return false
  }

  public setTimeoutAfterOrderCreate(timeout: boolean): void {
    this.state.scenarios.timeoutAfterOrderCreate = timeout
    this.saveToStorage()
  }

  public setFailNextOrderCreate(fail: boolean): void {
    this.state.scenarios.failNextOrderCreate = fail
    this.saveToStorage()
  }

  public setNextPaymentResult(result: OrderStatus | null): void {
    this.state.scenarios.nextPaymentResult = result
    this.saveToStorage()
  }

  public seedDemoOrders(userId = 'user-ana'): Order[] {
    if (!this.state.orders) this.state.orders = {}

    const confirmedOrder: Order = {
      id: 'ord-ana-conf-1',
      userId,
      idempotencyKey: 'idem-ana-conf-1',
      status: 'confirmed',
      createdAt: '2026-03-01T10:00:00.000Z',
      confirmedAt: '2026-03-01T10:02:00.000Z',
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      items: [
        {
          id: 'item-conf-1',
          nftId: 'nft-aurora-017',
          editionId: 'ed-1',
          name: 'Aurora #017',
          collectionName: 'Coleção Aurora',
          editionName: 'Primeira Edição',
          editionNumber: '#017',
          imageUrl: '/nfts/aurora.svg',
          quantity: 1,
          unitPriceEth: '1.275000000000000000',
          subtotalEth: '1.275000000000000000',
        },
      ],
      subtotalEth: '1.275000000000000000',
      discountEth: '0.000000000000000000',
      networkFeeEth: '0.002500000000000000',
      totalEth: '1.277500000000000000',
      coupon: null,
      buyer: {
        name: 'Ana Silva',
        email: 'ana@exemplo.com',
        walletAddress: '0x71C8564E3b3026D327732168434757342898a49B',
        network: 'ethereum',
      },
      version: 1,
    }

    const pendingOrder: Order = {
      id: 'ord-ana-pend-2',
      userId,
      idempotencyKey: 'idem-ana-pend-2',
      status: 'pending',
      createdAt: '2026-03-02T11:00:00.000Z',
      items: [
        {
          id: 'item-pend-2',
          nftId: 'nft-flora-006',
          editionId: 'ed-2',
          name: 'Flora Botanical #006',
          collectionName: 'Flora Botanical',
          editionName: 'Standard Edition',
          editionNumber: '#006',
          imageUrl: '/nfts/flora.svg',
          quantity: 2,
          unitPriceEth: '0.450000000000000000',
          subtotalEth: '0.900000000000000000',
        },
      ],
      subtotalEth: '0.900000000000000000',
      discountEth: '0.000000000000000000',
      networkFeeEth: '0.002500000000000000',
      totalEth: '0.902500000000000000',
      coupon: null,
      buyer: {
        name: 'Ana Silva',
        email: 'ana@exemplo.com',
        walletAddress: '0x71C8564E3b3026D327732168434757342898a49B',
        network: 'ethereum',
      },
      version: 1,
    }

    const declinedOrder: Order = {
      id: 'ord-ana-decl-3',
      userId,
      idempotencyKey: 'idem-ana-decl-3',
      status: 'declined',
      declineReason: 'Simulação de pagamento recusada pela carteira.',
      createdAt: '2026-03-03T12:00:00.000Z',
      items: [
        {
          id: 'item-decl-3',
          nftId: 'nft-afterlight-003',
          editionId: 'ed-3',
          name: 'Afterlight Horizon #003',
          collectionName: 'Afterlight',
          editionName: 'Collector Edition',
          editionNumber: '#003',
          imageUrl: '/nfts/afterlight.svg',
          quantity: 1,
          unitPriceEth: '2.500000000000000000',
          subtotalEth: '2.500000000000000000',
        },
      ],
      subtotalEth: '2.500000000000000000',
      discountEth: '0.000000000000000000',
      networkFeeEth: '0.002500000000000000',
      totalEth: '2.502500000000000000',
      coupon: null,
      buyer: {
        name: 'Ana Silva',
        email: 'ana@exemplo.com',
        walletAddress: '0x71C8564E3b3026D327732168434757342898a49B',
        network: 'ethereum',
      },
      version: 1,
    }

    this.state.orders[confirmedOrder.id] = confirmedOrder
    this.state.orders[pendingOrder.id] = pendingOrder
    this.state.orders[declinedOrder.id] = declinedOrder
    this.saveToStorage()

    return [confirmedOrder, pendingOrder, declinedOrder]
  }
}

export const mockStore = new MockStore()
