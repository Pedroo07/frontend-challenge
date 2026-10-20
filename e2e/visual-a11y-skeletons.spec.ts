import { expect, test } from '@playwright/test'

test.describe('Acessibilidade por teclado, Skeletons e Regressão Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      window.localStorage.removeItem('nft_auth_token')
      window.localStorage.removeItem('nft_guest_cart_id')
      window.sessionStorage.clear()
      await fetch('/api/_mock/scenarios/reset', { method: 'POST' })
    })
  })

  test('1. navegação por teclado e controle de foco em formulários e diálogos', async ({ page }) => {
    await page.goto('/login')

    const emailInput = page.getByLabel('E-mail')
    const passwordInput = page.getByLabel('Senha')

    await emailInput.focus()
    await expect(emailInput).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(passwordInput).toBeFocused()

    await emailInput.fill('invalido')
    const submitBtn = page.getByRole('button', { name: 'Entrar' })
    await submitBtn.click()
    const emailValidationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(emailValidationMessage.length).toBeGreaterThan(0)

    await page.goto('/')
    const searchInput = page.getByRole('searchbox', { name: 'Buscar NFTs' })
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
    await page.keyboard.type('Aurora')
    await expect(page).toHaveURL(/q=Aurora/)
  })

  test('2. exibição de feedback de falha e recuperação funcional', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()

    const scenarioOk = await page.evaluate(async () => {
      const res = await fetch('/api/_mock/scenarios/nft-list-error-once', { method: 'POST' })
      return res.ok
    })
    expect(scenarioOk).toBe(true)

    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Aurora')

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Não foi possível atualizar o catálogo')

    const retryBtn = page.getByRole('button', { name: 'Tentar novamente' })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    await expect(page.getByText('4 obras encontradas')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()
  })

  test('3. regressão visual: telas de Início e Detalhe (Desktop e Mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
    await expect(page).toHaveScreenshot('home-desktop.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
    await expect(page).toHaveScreenshot('home-mobile.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/nfts/nft-aurora-017', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await expect(page).toHaveScreenshot('detail-desktop.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/nfts/nft-aurora-017', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await expect(page).toHaveScreenshot('detail-mobile.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })
  })

  test('4. regressão visual: telas de Carrinho e Checkout (Desktop e Mobile)', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017', { waitUntil: 'networkidle' })
    const addBtn = page.getByRole('button', { name: /adicionar.*ao carrinho/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await expect(page.getByRole('status')).toContainText('adicionado ao carrinho')

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/carrinho', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
    await expect(page).toHaveScreenshot('cart-desktop.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/carrinho', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
    await expect(page).toHaveScreenshot('cart-mobile.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/(?:\?.*)?$/)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/checkout', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()
    await expect(page).toHaveScreenshot('checkout-desktop.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/checkout', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()
    await expect(page).toHaveScreenshot('checkout-mobile.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
    })
  })
})
