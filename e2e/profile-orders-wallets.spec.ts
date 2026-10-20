import { expect, test, type Page } from '@playwright/test'

async function resetEnvironment(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.removeItem('nft_auth_token')
    window.localStorage.removeItem('nft_guest_cart_id')
    window.localStorage.removeItem('nft_mock_store_v1')
    window.sessionStorage.clear()
    await fetch('/api/_mock/scenarios/reset', { method: 'POST' })
  })
}

async function loginAsAna(page: Page) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()
  await page.getByLabel('E-mail').fill('ana@exemplo.com')
  await page.getByLabel('Senha').fill('Password123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')
}

async function loginAsLucas(page: Page) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()
  await page.getByLabel('E-mail').fill('lucas@exemplo.com')
  await page.getByLabel('Senha').fill('Password123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('user-name')).toHaveText('Lucas Costa')
}

async function seedOrdersForAna(page: Page) {
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/_mock/scenarios/seed-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-ana' }),
    })
    return { ok: res.ok, status: res.status }
  })
  expect(result.ok).toBe(true)
}

test.describe('Etapa 6 — Perfil do colecionador, histórico de pedidos e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await resetEnvironment(page)
  })

  test('1. Acesso ao perfil autenticado', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil')

    await expect(page.getByRole('heading', { name: 'Perfil do Colecionador' })).toBeVisible()
    await expect(page.getByTestId('profile-display-name')).toHaveText('Ana Silva')
    await expect(page.getByTestId('profile-display-email')).toHaveText('ana@exemplo.com')
    await expect(page.getByTestId('profile-name-input')).toHaveValue('Ana Silva')
    await expect(page.getByTestId('profile-email-input')).toHaveValue('ana@exemplo.com')
  })

  test('2. Redirecionamento de usuário não autenticado para login e retorno', async ({ page }) => {
    await page.goto('/perfil')

  
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil|\/login\?redirect=\/perfil/)
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()


    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/perfil/)
    await expect(page.getByRole('heading', { name: 'Perfil do Colecionador' })).toBeVisible()
  })

  test('3. Carregamento e atualização dos dados de perfil', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil')

    await page.getByTestId('profile-name-input').fill('Ana Silva VIP')
    await page.getByTestId('profile-bio-input').fill('Colecionadora experiente de arte digital generativa.')
    await page.getByTestId('save-profile-btn').click()

    const feedback = page.getByTestId('profile-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('Perfil atualizado com sucesso!')

    await expect(page.getByTestId('profile-display-name')).toHaveText('Ana Silva VIP')
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva VIP')
  })

  test('4. Tratamento de erro ao salvar informações e retry funcional', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil')


    await expect(page.getByTestId('profile-name-input')).toHaveValue('Ana Silva')


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/account-fail-once', { method: 'POST' })
    })

    await page.getByTestId('profile-name-input').fill('Ana Silva Tentativa')
    await page.getByTestId('save-profile-btn').click()

    const feedback = page.getByTestId('profile-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('salvar perfil')


    const retryBtn = feedback.getByRole('button', { name: 'Tentar novamente' })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    await expect(page.getByTestId('profile-feedback')).toContainText('Perfil atualizado com sucesso!')
    await expect(page.getByTestId('profile-display-name')).toHaveText('Ana Silva Tentativa')
  })

  test('5. Histórico vazio para uma conta sem pedidos', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=pedidos')

    await expect(page.getByTestId('empty-orders-view')).toBeVisible()
    await expect(page.getByText('Nenhum pedido encontrado')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar Catálogo' })).toBeVisible()
  })

  test('6. Listagem dos pedidos da conta autenticada', async ({ page }) => {
    await loginAsAna(page)
    await seedOrdersForAna(page)
    await page.goto('/perfil?tab=pedidos')

    await expect(page.getByTestId('order-card-ord-ana-conf-1')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-pend-2')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-decl-3')).toBeVisible()

    await expect(page.getByTestId('order-total-ord-ana-conf-1')).toContainText('1.2775 ETH')
  })

  test('7. Exibição correta de pedidos confirmados, pendentes, recusados e filtros', async ({ page }) => {
    await loginAsAna(page)
    await seedOrdersForAna(page)
    await page.goto('/perfil?tab=pedidos')

    await expect(page.getByTestId('order-status-ord-ana-conf-1')).toHaveText('Confirmado')
    await expect(page.getByTestId('order-status-ord-ana-pend-2')).toHaveText('Pendente')
    await expect(page.getByTestId('order-status-ord-ana-decl-3')).toHaveText('Recusado')


    await page.getByTestId('filter-confirmed').click()
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-pend-2')).not.toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-decl-3')).not.toBeVisible()


    await page.getByTestId('filter-pending').click()
    await expect(page.getByTestId('order-card-ord-ana-pend-2')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).not.toBeVisible()


    await page.getByTestId('filter-declined').click()
    await expect(page.getByTestId('order-card-ord-ana-decl-3')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).not.toBeVisible()


    await page.getByTestId('filter-all').click()
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-pend-2')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-decl-3')).toBeVisible()
  })

  test('8. Acesso ao recibo imutável de um pedido existente', async ({ page }) => {
    await loginAsAna(page)
    await seedOrdersForAna(page)
    await page.goto('/perfil?tab=pedidos')

    await page.getByTestId('view-receipt-ord-ana-conf-1').click()

    await expect(page).toHaveURL(/\/pedidos\/ord-ana-conf-1/)
    await expect(page.getByText('Aurora #017')).toBeVisible()
    await expect(page.getByText('ord-ana-conf-1')).toBeVisible()
  })

  test('9. Atualização do estado de um pedido no histórico via Socket.IO', async ({ page }) => {
    await loginAsAna(page)
    await seedOrdersForAna(page)
    await page.goto('/perfil?tab=pedidos')

    await expect(page.getByTestId('order-status-ord-ana-pend-2')).toHaveText('Pendente')


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-order-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'ord-ana-pend-2',
          status: 'confirmed',
          version: 2,
          transactionHash: '0xabcdef1234567890abcdef1234567890',
        }),
      })
    })


    await expect(page.getByTestId('order-status-ord-ana-pend-2')).toHaveText('Confirmado')
  })

  test('10. Isolamento do histórico ao trocar de usuário', async ({ page }) => {
    await loginAsAna(page)
    await seedOrdersForAna(page)
    await page.goto('/perfil?tab=pedidos')
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).toBeVisible()


    await page.getByRole('button', { name: 'Sair' }).first().click()
    await expect(page.getByTestId('user-name')).not.toBeVisible()


    await loginAsLucas(page)
    await page.goto('/perfil?tab=pedidos')

    await expect(page.getByTestId('empty-orders-view')).toBeVisible()
    await expect(page.getByTestId('order-card-ord-ana-conf-1')).not.toBeVisible()
  })

  test('11. Listagem das carteiras vinculadas à conta', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')

    await expect(page.getByTestId('wallet-card-w-ana-1')).toBeVisible()
    await expect(page.getByTestId('primary-badge-w-ana-1')).toHaveText('Principal')
    await expect(page.getByTestId('wallet-address-w-ana-1')).toContainText('0x71C8564E')

    await expect(page.getByTestId('wallet-card-w-ana-2')).toBeVisible()
    await expect(page.getByTestId('primary-badge-w-ana-2')).not.toBeVisible()
  })

  test('12. Adição de uma carteira simulada', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')

    await page.getByTestId('open-add-wallet-btn').click()
    await expect(page.getByTestId('add-wallet-section')).toBeVisible()

    await page.getByTestId('wallet-label-input').fill('Ledger Hardware')
    await page.getByTestId('wallet-address-input').fill('0x9999999999999999999999999999999999999999')
    await page.getByTestId('submit-add-wallet-btn').click()

    const feedback = page.getByTestId('wallet-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('Carteira vinculada com sucesso!')

    await expect(page.getByText('Ledger Hardware')).toBeVisible()
  })

  test('13. Alteração da carteira principal', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')


    await expect(page.getByTestId('primary-badge-w-ana-1')).toBeVisible()
    await expect(page.getByTestId('primary-badge-w-ana-2')).not.toBeVisible()


    await page.getByTestId('set-primary-btn-w-ana-2').click()

    const feedback = page.getByTestId('wallet-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('Carteira principal atualizada com sucesso!')

    await expect(page.getByTestId('primary-badge-w-ana-2')).toBeVisible()
    await expect(page.getByTestId('primary-badge-w-ana-1')).not.toBeVisible()
  })

  test('14. Garantia de que somente uma carteira seja marcada como principal', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')

    const primaryBadges = page.locator('[data-testid^="primary-badge-"]')
    await expect(primaryBadges).toHaveCount(1)


    await page.getByTestId('set-primary-btn-w-ana-2').click()
    await expect(primaryBadges).toHaveCount(1)
  })

  test('15. Remoção de carteira secundária quando permitida', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')

    await expect(page.getByTestId('wallet-card-w-ana-2')).toBeVisible()
    await page.getByTestId('remove-wallet-btn-w-ana-2').click()

    const feedback = page.getByTestId('wallet-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('Carteira removida com sucesso!')

    await expect(page.getByTestId('wallet-card-w-ana-2')).not.toBeVisible()
  })

  test('16. Tratamento de erros ou conflitos na API de carteiras', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')


    await page.getByTestId('remove-wallet-btn-w-ana-1').click()
    const feedback = page.getByTestId('wallet-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText('A carteira principal não pode ser removida')
    await expect(page.getByTestId('wallet-card-w-ana-1')).toBeVisible()


    await page.getByTestId('open-add-wallet-btn').click()
    await page.getByTestId('wallet-address-input').fill('0x71C8564E3b3026D327732168434757342898a49B')
    await page.getByTestId('submit-add-wallet-btn').click()

    await expect(page.getByTestId('wallet-feedback')).toContainText('já está')
  })

  test('17. Isolamento das carteiras entre usuários', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil?tab=carteiras')
    await expect(page.getByTestId('wallet-card-w-ana-1')).toBeVisible()
    await expect(page.getByTestId('wallet-card-w-lucas-1')).not.toBeVisible()


    await page.getByRole('button', { name: 'Sair' }).first().click()


    await loginAsLucas(page)
    await page.goto('/perfil?tab=carteiras')

    await expect(page.getByTestId('wallet-card-w-lucas-1')).toBeVisible()
    await expect(page.getByTestId('wallet-card-w-ana-1')).not.toBeVisible()
    await expect(page.getByTestId('wallet-card-w-ana-2')).not.toBeVisible()
  })

  test('18. Persistência dos dados após atualizar a página', async ({ page }) => {
    await loginAsAna(page)
    await page.goto('/perfil')

    await page.getByTestId('profile-bio-input').fill('Bio persistente pós refresh.')
    await page.getByTestId('save-profile-btn').click()
    await expect(page.getByTestId('profile-feedback')).toContainText('Perfil atualizado com sucesso!')


    await page.reload()

    await expect(page.getByTestId('profile-bio-input')).toHaveValue('Bio persistente pós refresh.')
    await expect(page.getByTestId('profile-display-name')).toHaveText('Ana Silva')
  })

  test('19. Layout e responsividade em 390px, 768px e 1440px', async ({ page }) => {
    await loginAsAna(page)


    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do Colecionador' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toBeVisible()


    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/perfil?tab=carteiras')
    await expect(page.getByRole('heading', { name: 'Carteiras Vinculadas' })).toBeVisible()


    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/perfil?tab=pedidos')
    await expect(page.getByTestId('tab-pedidos')).toBeVisible()
    await expect(page.getByTestId('user-name')).toBeVisible()
  })
})
