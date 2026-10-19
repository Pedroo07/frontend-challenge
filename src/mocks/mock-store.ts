import type { User } from './contracts'

type StoredUser = User & {
  passwordHash: string
}

type StoredSession = {
  token: string
  userId: string
  expiresAt: number
}

type MockStoreState = {
  users: StoredUser[]
  sessions: StoredSession[]
  favorites: Record<string, string[]>
  scenarios: {
    failNextNftListRequest: boolean
    failNextFavoriteRequest: boolean
    forceSessionExpired: boolean
  }
}

const STORAGE_KEY = 'nft_mock_store_v1'

const initialUsers: StoredUser[] = [
  {
    id: 'user-ana',
    name: 'Ana Silva',
    email: 'ana@exemplo.com',
    passwordHash: 'Password123!',
    avatarUrl: '/avatars/ana.png',
  },
  {
    id: 'user-lucas',
    name: 'Lucas Costa',
    email: 'lucas@exemplo.com',
    passwordHash: 'Password123!',
    avatarUrl: '/avatars/lucas.png',
  },
]

const initialFavorites: Record<string, string[]> = {
  'user-ana': ['nft-aurora-017'],
  'user-lucas': ['nft-flora-006'],
}

function createInitialState(): MockStoreState {
  return {
    users: [...initialUsers],
    sessions: [
      {
        token: 'tok-user-ana-preset',
        userId: 'user-ana',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    ],
    favorites: { ...initialFavorites },
    scenarios: {
      failNextNftListRequest: false,
      failNextFavoriteRequest: false,
      forceSessionExpired: false,
    },
  }
}

class MockStore {
  private state: MockStoreState

  constructor() {
    this.state = this.loadFromStorage() ?? createInitialState()
  }

  private loadFromStorage(): MockStoreState | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as MockStoreState
    } catch {
      return null
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  public reset(): void {
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
    }
  }

  public findUserById(id: string): User | undefined {
    const user = this.state.users.find((u) => u.id === id)
    if (!user) return undefined
    return this.toPublicUser(user)
  }

  public registerUser(name: string, email: string, passwordHash: string): { user: User; token: string } {
    const normalized = email.trim().toLowerCase()
    if (this.findUserByEmail(normalized)) {
      throw new Error('E-mail já cadastrado.')
    }

    const newUser: StoredUser = {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: normalized,
      passwordHash,
    }

    this.state.users.push(newUser)
    this.state.favorites[newUser.id] = []

    const session = this.createSession(newUser.id)
    this.saveToStorage()

    return { user: this.toPublicUser(newUser), token: session.token }
  }

  public validateCredentials(email: string, password: string): { user: User; token: string } | null {
    const user = this.findUserByEmail(email)
    if (!user || user.passwordHash !== password) {
      return null
    }

    const session = this.createSession(user.id)
    this.saveToStorage()

    return { user: this.toPublicUser(user), token: session.token }
  }

  public createSession(userId: string): StoredSession {
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
}

export const mockStore = new MockStore()
