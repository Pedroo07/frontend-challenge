import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'

export function SiteFooter() {
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim()) return
    setNewsletterSubscribed(true)
  }

  return (
    <footer className="mx-auto w-full max-w-300 px-4 pb-8 sm:px-6 md:px-8 lg:px-0">
      {/* 4 Feature cards / Newsletter */}
      <div className="grid gap-6 rounded-sm bg-card p-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 lg:p-8">
        <FooterFeature icon="W" title="Segurança da carteira">
          Proteja sua carteira e colecione arte digital verificada com confiança.
        </FooterFeature>
        <FooterFeature icon="C" title="Criadores em destaque">
          Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.
        </FooterFeature>
        <FooterFeature icon="D" title="Alertas de lançamentos">
          Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.
        </FooterFeature>

        <div className="min-w-0">
          <h2 className="font-mono text-sm font-bold leading-tight text-foreground">
            Antecipe-se ao próximo lançamento
          </h2>
          {newsletterSubscribed ? (
            <p className="mt-3 rounded bg-emerald-500/10 p-2 font-mono text-xs text-emerald-400">
              ✓ Inscrição confirmada! Fique atento às novidades.
            </p>
          ) : (
            <form className="mt-3 flex min-w-0" onSubmit={handleSubscribe}>
              <label className="sr-only" htmlFor="newsletter-email">
                Inscrição na newsletter
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="digite seu e-mail..."
                className="min-w-0 flex-1 rounded-l-sm bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="rounded-r-sm bg-primary px-3 font-mono text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-light"
              >
                Enviar
              </button>
            </form>
          )}
          <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
          </p>
        </div>
      </div>

      {/* Kurio info bar */}
      <div className="grid gap-3 bg-surface-dark px-5 py-4 font-mono text-[10px] text-foreground sm:grid-cols-4 sm:items-center">
        <strong className="tracking-[0.14em]">KURIO</strong>
        <span className="sm:col-span-2 text-muted-foreground sm:text-foreground">
          Feito para colecionadores, criadores e cultura
        </span>
        <div className="flex flex-col gap-1 sm:text-right">
          <a href="mailto:contato@email.com" className="hover:text-primary transition-colors">contato@email.com</a>
          <span className="text-muted-foreground">+55 11 4002 8922</span>
        </div>
      </div>

      {/* Nav columns */}
      <div className="grid gap-6 bg-card px-5 py-6 sm:grid-cols-2 lg:grid-cols-5">
        <FooterLinks
          title="Meu perfil"
          links={[
            { label: 'Meu perfil', href: '/login' },
            { label: 'Minha coleção', href: '/login' },
            { label: 'Atividade', href: '/login' },
            { label: 'Estúdio do criador', href: '/login' },
            { label: 'Lista de interesse', href: '/login' },
          ]}
        />
        <FooterLinks
          title="Central de ajuda"
          links={[
            { label: 'Central de ajuda', href: '/' },
            { label: 'Como comprar NFTs', href: '/' },
            { label: 'Carteira e segurança', href: '/' },
            { label: 'Política do mercado', href: '/' },
            { label: 'Denunciar item', href: '/' },
          ]}
        />
        <FooterLinks
          title="Coleções"
          links={[
            { label: 'Arte digital', href: '/' },
            { label: 'Fotografia', href: '/' },
            { label: 'Música', href: '/' },
            { label: 'Arte 3D', href: '/' },
            { label: 'Utilidade', href: '/' },
          ]}
        />
        <section>
          <h2 className="mb-2 font-mono text-sm font-bold text-foreground">Redes sociais</h2>
          <div className="flex items-center gap-3 text-muted-foreground">
            <SocialIcon label="Facebook" path="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
            <SocialIcon label="Instagram" path="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 2h11A4.5 4.5 0 0122 6.5v11a4.5 4.5 0 01-4.5 4.5h-11A4.5 4.5 0 012 17.5v-11A4.5 4.5 0 016.5 2z" />
            <SocialIcon label="Twitter" path="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
            <SocialIcon label="LinkedIn" path="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z" />
            <SocialIcon label="YouTube" path="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" />
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-mono text-sm font-bold text-foreground">Carteiras compatíveis</h2>
          <div className="rounded border border-border-soft bg-surface-raised px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            METAMASK <span className="text-primary">·</span> WALLETCONNECT <span className="text-primary">·</span> COINBASE
          </div>
        </section>
      </div>

      <p className="py-4 text-center font-mono text-[10px] text-muted-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}

function FooterFeature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <article className="border-b border-border-soft pb-5 last:border-0 last:pb-0 sm:border-b-0 sm:border-r sm:pr-5 lg:min-h-36">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
        {icon}
      </span>
      <h2 className="font-mono text-sm font-bold text-foreground">{title}</h2>
      <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">{children}</p>
    </article>
  )
}

function FooterLinks({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-sm font-bold text-foreground">{title}</h2>
      <ul className="grid gap-1.5 font-mono text-[10px] text-muted-foreground">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.href} className="transition-colors hover:text-primary">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SocialIcon({ label, path }: { label: string; path: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      onClick={(e) => e.preventDefault()}
      className="grid size-7 place-items-center rounded-md border border-border-soft bg-surface-raised transition-colors hover:border-primary hover:text-primary"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
        <path d={path} />
      </svg>
    </a>
  )
}
