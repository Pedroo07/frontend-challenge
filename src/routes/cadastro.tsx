import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import React, { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { catalogSearchDefaults } from '@/lib/catalog-options'

type CadastroSearch = {
  redirect?: string
}

export const Route = createFileRoute('/cadastro')({
  validateSearch: (search: Record<string, unknown>): CadastroSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: CadastroPage,
})

function CadastroPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    setIsSubmitting(true)

    try {
      await register({ name, email, password })
      const destination = search.redirect && search.redirect.startsWith('/') ? search.redirect : '/'
      if (destination.startsWith('/nfts/')) {
        const nftId = destination.replace('/nfts/', '').split('?')[0] ?? ''
        void navigate({ to: '/nfts/$nftId', params: { nftId } })
      } else if (destination === '/') {
        void navigate({ to: '/', search: catalogSearchDefaults })
      } else {
        window.location.assign(destination)
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const serverMessage = error.response?.data?.message || error.response?.data?.error
        if (serverMessage) {
          setErrorMessage(String(serverMessage))
        } else if (typeof error.response?.data === 'string' && error.response.data.trim()) {
          setErrorMessage(error.response.data.trim())
        } else if (error.response?.status === 409) {
          setErrorMessage('E-mail já cadastrado.')
        } else if (error.response?.status === 404) {
          setErrorMessage('Serviço de cadastro não encontrado (404).')
        } else if (error.message) {
          setErrorMessage(error.message)
        } else {
          setErrorMessage('Não foi possível realizar o cadastro. Tente novamente.')
        }
      } else if (error instanceof Error && error.message) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Não foi possível realizar o cadastro. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-8 font-mono text-foreground sm:px-6 sm:py-12">
      <header className="mx-auto w-full max-w-md pb-6 text-center">
        <Link
          to="/"
          search={catalogSearchDefaults}
          aria-label="Kurio, voltar para o início"
          className="inline-block text-2xl font-bold tracking-[0.2em] text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          KURIO
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md">
        <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
          <Link
            to={search.redirect && search.redirect.startsWith('/') ? search.redirect : '/'}
            aria-label="Fechar"
            className="absolute right-5 top-5 grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"
          >
            ✕
          </Link>

          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Criar sua conta
            </h1>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
              <Link
                to="/login"
                search={{ redirect: search.redirect }}
                className="text-muted-foreground transition hover:text-foreground"
              >
                Entrar
              </Link>
              <span className="text-border-soft">|</span>
              <span className="text-primary">Criar conta</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Crie seu perfil de colecionador e conecte uma carteira quando quiser.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div>
              <label htmlFor="cadastro-name" className="block text-xs font-semibold text-muted-foreground">
                Nome completo
              </label>
              <input
                id="cadastro-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome de usuário"
                className="mt-1.5 h-12 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <label htmlFor="cadastro-email" className="block text-xs font-semibold text-muted-foreground">
                E-mail
              </label>
              <input
                id="cadastro-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                className="mt-1.5 h-12 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <label htmlFor="cadastro-password" className="block text-xs font-semibold text-muted-foreground">
                Senha (mínimo 6 caracteres)
              </label>
              <div className="relative mt-1.5">
                <input
                  id="cadastro-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="h-12 w-full rounded-lg border border-border bg-background px-3.5 pr-11 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar' : 'Exibir'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="cadastro-confirm-password" className="block text-xs font-semibold text-muted-foreground">
                Confirmar senha
              </label>
              <div className="relative mt-1.5">
                <input
                  id="cadastro-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar senha"
                  className="h-12 w-full rounded-lg border border-border bg-background px-3.5 pr-11 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Ocultar' : 'Exibir'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-soft" />
            <span className="font-mono text-xs text-muted-foreground">Ou continue com</span>
            <div className="h-px flex-1 bg-border-soft" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setName('Mariana Silva')
                setEmail('mariana@exemplo.com')
                setPassword('Password123!')
                setConfirmPassword('Password123!')
              }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card hover:bg-surface-raised font-mono text-xs font-semibold text-foreground transition"
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
              onClick={() => {
                setName('Mariana Silva')
                setEmail('mariana@exemplo.com')
                setPassword('Password123!')
                setConfirmPassword('Password123!')
              }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card hover:bg-surface-raised font-mono text-xs font-semibold text-foreground transition"
            >
              <svg className="size-4" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continuar com Facebook
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Já tem uma conta?{' '}
            <Link
              to="/login"
              search={{ redirect: search.redirect }}
              className="font-semibold text-foreground hover:text-primary transition"
            >
              Entre
            </Link>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-md pt-8 text-center text-xs text-muted-foreground/60">
        &copy; 2026 Kurio NFT Marketplace. Todos os direitos reservados.
      </footer>
    </div>
  )
}
