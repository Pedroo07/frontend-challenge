import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [userSelectedMode, setUserSelectedMode] = useState<'login' | 'register' | null>(null)
  const mode = userSelectedMode ?? initialMode
  const { login, register } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPassword, setLoginShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regShowPassword, setRegShowPassword] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setUserSelectedMode(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Preencha todos os campos.')
      return
    }

    try {
      setIsSubmitting(true)
      await login({ email: loginEmail.trim(), password: loginPassword })
      handleClose()
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message || err.response?.data?.error
        if (serverMessage) {
          setLoginError(String(serverMessage))
        } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
          setLoginError(err.response.data.trim())
        } else if (err.message) {
          setLoginError(err.message)
        } else {
          setLoginError('Credenciais inválidas. Tente novamente.')
        }
      } else if (err instanceof Error && err.message) {
        setLoginError(err.message)
      } else {
        setLoginError('Credenciais inválidas. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSocialLogin = async (email: string) => {
    setLoginError(null)
    try {
      setIsSubmitting(true)
      await login({ email, password: 'Password123!' })
      handleClose()
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message || err.response?.data?.error
        if (serverMessage) {
          setLoginError(String(serverMessage))
        } else if (err.message) {
          setLoginError(err.message)
        } else {
          setLoginError('Não foi possível entrar com a rede social.')
        }
      } else if (err instanceof Error && err.message) {
        setLoginError(err.message)
      } else {
        setLoginError('Não foi possível entrar com a rede social.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setRegSuccess(null)

    if (!regName.trim() || !regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
      setRegError('Preencha todos os campos.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('As senhas não coincidem.')
      return
    }

    if (regPassword.length < 8) {
      setRegError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    try {
      setIsSubmitting(true)
      await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      })
      setRegSuccess('Conta criada com sucesso! Faça login para continuar.')
      setUserSelectedMode('login')
      setLoginEmail(regEmail.trim())
      setLoginPassword(regPassword)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message || err.response?.data?.error
        if (serverMessage) {
          setRegError(String(serverMessage))
        } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
          setRegError(err.response.data.trim())
        } else if (err.response?.status === 409) {
          setRegError('E-mail já cadastrado.')
        } else if (err.response?.status === 404) {
          setRegError('Serviço de cadastro não encontrado (404).')
        } else if (err.message) {
          setRegError(err.message)
        } else {
          setRegError('Não foi possível criar a conta.')
        }
      } else if (err instanceof Error && err.message) {
        setRegError(err.message)
      } else {
        setRegError('Não foi possível criar a conta.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-soft bg-card p-6 sm:p-8 shadow-2xl z-10 font-mono">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar janela"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          ✕
        </button>

        <div className="flex border-b border-border-soft pb-3 mb-6">
          <button
            type="button"
            onClick={() => {
              setUserSelectedMode('login')
              setLoginError(null)
            }}
            className={`flex-1 pb-2 font-mono text-sm font-bold transition-colors ${
              mode === 'login'
                ? 'text-primary border-b-2 border-primary -mb-[13px]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setUserSelectedMode('register')
              setRegError(null)
            }}
            className={`flex-1 pb-2 font-mono text-sm font-bold transition-colors ${
              mode === 'register'
                ? 'text-primary border-b-2 border-primary -mb-[13px]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {mode === 'login' ? (
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-foreground">
              Entrar na sua conta
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesse sua coleção e carteira digital na Kurio.
            </p>

            {loginError && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/15 p-3 text-xs text-destructive">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setLoginShowPassword((s) => !s)}
                    aria-label={loginShowPassword ? 'Ocultar' : 'Exibir'}
                    className="text-[11px] text-muted-foreground hover:text-primary transition"
                  >
                    {loginShowPassword ? 'Ocultar' : 'Exibir'}
                  </button>
                </div>
                <input
                  type={loginShowPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground shadow transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-soft" />
                <span className="font-mono text-[11px] text-muted-foreground">Ou continue com</span>
                <div className="h-px flex-1 bg-border-soft" />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSocialLogin('ana@exemplo.com')}
                  className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card hover:bg-surface-raised font-mono text-xs font-semibold text-foreground transition"
                >
                  <svg className="size-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.43 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.24C.45 8.14 0 9.99 0 12s.45 3.86 1.24 5.43l4.04-3.14z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.57 1.24 6.57l4.04 3.14c.95-2.83 3.6-4.96 6.72-4.96z" />
                  </svg>
                  Continuar com Google
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSocialLogin('lucas@exemplo.com')}
                  className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card hover:bg-surface-raised font-mono text-xs font-semibold text-foreground transition"
                >
                  <svg className="size-4" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Continuar com Facebook
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-muted-foreground">
                Não possui conta?{' '}
                <button
                  type="button"
                  onClick={() => setUserSelectedMode('register')}
                  className="font-bold text-primary hover:underline"
                >
                  Cadastre-se
                </button>
              </div>

              <div className="rounded bg-surface-raised p-2.5 text-[10px] text-muted-foreground">
                <span className="font-bold text-foreground">Contas de teste:</span>
                <br />
                ana@exemplo.com / Password123!
                <br />
                lucas@exemplo.com / Password123!
              </div>
            </form>
          </div>
        ) : (
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-foreground">
              Criar sua conta
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Junte-se à comunidade de colecionadores e criadores Kurio.
            </p>

            {regError && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/15 p-3 text-xs text-destructive">
                {regError}
              </div>
            )}

            {regSuccess && (
              <div role="status" className="mt-4 rounded-md border border-success/40 bg-success/15 p-3 text-xs text-success">
                {regSuccess}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Seu nome"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-foreground">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setRegShowPassword((s) => !s)}
                    aria-label={regShowPassword ? 'Ocultar' : 'Exibir'}
                    className="text-[11px] text-muted-foreground hover:text-primary transition"
                  >
                    {regShowPassword ? 'Ocultar' : 'Exibir'}
                  </button>
                </div>
                <input
                  type={regShowPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Confirmar senha
                </label>
                <input
                  type={regShowPassword ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground shadow transition hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                {isSubmitting ? 'Criando conta...' : 'Criar conta'}
              </button>

              <div className="pt-2 text-center text-xs text-muted-foreground">
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setUserSelectedMode('login')}
                  className="font-bold text-primary hover:underline"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
