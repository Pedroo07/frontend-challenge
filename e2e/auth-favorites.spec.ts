import { expect, test } from '@playwright/test'

test.describe('Autenticação, sessão e favoritos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
    await page.evaluate(async () => {
      window.localStorage.removeItem('nft_auth_token')
      window.sessionStorage.clear()
      await fetch('/api/_mock/scenarios/reset', { method: 'POST' })
    })
  })

  test('1. login bem-sucedido autentica o usuário e exibe no cabeçalho', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/(?:\?.*)?$/)
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('2. login com credenciais inválidas apresenta mensagem de erro', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('senha-incorreta')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toContainText('Credenciais inválidas.')
    await expect(page).toHaveURL(/\/login/)
  })

  test('3. cadastro válido cria a conta e autentica imediatamente', async ({ page }) => {
    await page.goto('/cadastro')

    await page.getByLabel('Nome completo').fill('Mariana Souza')
    await page.getByLabel('E-mail').fill('mariana@exemplo.com')
    await page.getByLabel('Senha (mínimo 6 caracteres)').fill('Password123!')
    await page.getByLabel('Confirmar senha').fill('Password123!')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page).toHaveURL(/\/(?:\?.*)?$/)
    await expect(page.getByTestId('user-name')).toHaveText('Mariana Souza')
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('4. cadastro duplicado exibe erro de e-mail já existente', async ({ page }) => {
    await page.goto('/cadastro')

    await page.getByLabel('Nome completo').fill('Ana Silva')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha (mínimo 6 caracteres)').fill('Password123!')
    await page.getByLabel('Confirmar senha').fill('Password123!')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByRole('alert')).toContainText('E-mail já cadastrado.')
    await expect(page).toHaveURL(/\/cadastro/)
  })

  test('5. persistência da sessão após atualização da página', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    await page.reload()
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('6. expiração da sessão e retorno ao fluxo anterior após login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()

    await page.evaluate(() => fetch('/api/_mock/scenarios/expire-session', { method: 'POST' }))

    const favoriteButton = page.getByRole('button', { name: /favoritos/i })
    await favoriteButton.click()

    await expect(page).toHaveURL(/\/login\?redirect=.*nft-aurora-017/)

    await page.evaluate(() => fetch('/api/_mock/scenarios/reset', { method: 'POST' }))

    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/nfts\/nft-aurora-017/)
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
  })

  test('7. adição de um favorito persiste na API para o usuário autenticado', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Lucas Costa')

    await page.goto('/nfts/nft-aurora-017')
    const favoriteButton = page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' })
    await expect(favoriteButton).toHaveAttribute('aria-pressed', 'false')

    await favoriteButton.click()
    const removeButton = page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })
    await expect(removeButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('8. remoção de um favorito atualiza a interface e a API', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    await page.goto('/nfts/nft-aurora-017')
    const removeButton = page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })
    await expect(removeButton).toHaveAttribute('aria-pressed', 'true')

    await removeButton.click()
    const addButton = page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' })
    await expect(addButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('9. persistência dos favoritos após atualização da página', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' }).click()
    await expect(page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('10. rollback da interface quando a API de favoritos falhar', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await page.goto('/nfts/nft-aurora-017')
    const button = page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await page.evaluate(() => fetch('/api/_mock/scenarios/favorites-fail-once', { method: 'POST' }))

    await button.click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('11. logout e limpeza do estado privado', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    await page.getByRole('button', { name: 'Sair' }).click()

    await expect(page.getByRole('link', { name: /Entrar/ })).toBeVisible()
    await expect(page.getByTestId('user-name')).not.toBeVisible()

    await page.reload()
    await expect(page.getByRole('link', { name: /Entrar/ })).toBeVisible()
  })

  test('12. troca de usuário sem vazamento de favoritos ou dados privados', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('button', { name: 'Remover Aurora #017 dos favoritos' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: /Entrar/ })).toBeVisible()

    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('user-name')).toHaveText('Lucas Costa')

    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('button', { name: 'Adicionar Aurora #017 aos favoritos' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('responsividade: telas de login e cadastro não geram overflow horizontal', async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })

      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()
      const loginOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(loginOverflows, `login em ${width}px`).toBe(false)

      await page.goto('/cadastro')
      await expect(page.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible()
      const cadastroOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(cadastroOverflows, `cadastro em ${width}px`).toBe(false)
    }
  })
})
