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
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setErrorMessage(String(error.response.data.message))
      } else {
        setErrorMessage('Não foi possível realizar o cadastro. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-8 font-mono text-foreground sm:px-6 sm:py-12">
      <header className="mx-auto w-full max-w-md pb-6 text-center">
        <Link
          to="/"
          search={catalogSearchDefaults}
          aria-label="Kurio, voltar para o início"
          className="inline-block text-xl font-bold tracking-[0.16em] text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          KURIO
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Criar sua conta
            </h1>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              Junte-se ao marketplace para colecionar e negociar obras exclusivas.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive sm:text-sm"
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
                placeholder="Ex.: Mariana Silva"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface-raised px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
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
                placeholder="seu.email@exemplo.com"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface-raised px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <label htmlFor="cadastro-password" className="block text-xs font-semibold text-muted-foreground">
                Senha (mínimo 6 caracteres)
              </label>
              <input
                id="cadastro-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface-raised px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <label htmlFor="cadastro-confirm-password" className="block text-xs font-semibold text-muted-foreground">
                Confirmar senha
              </label>
              <input
                id="cadastro-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface-raised px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground sm:text-sm">
            Já tem uma conta?{' '}
            <Link
              to="/login"
              search={{ redirect: search.redirect }}
              className="font-semibold text-primary hover:underline focus-visible:outline-1 focus-visible:outline-primary"
            >
              Entrar
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
