import { expect, test, type Page } from '@playwright/test'

async function resetEnvironment(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
  await page.evaluate(async () => {
    window.localStorage.removeItem('nft_auth_token')
    window.localStorage.removeItem('nft_guest_cart_id')
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

async function addAuroraToCart(page: Page) {
  await page.goto('/nfts/nft-aurora-017')
  await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
  await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
  await expect(page.getByTestId('cart-badge-count')).toHaveText('1')
}

async function connectWallet(page: Page) {
  await page.getByTestId('connect-wallet-btn').click()
  await expect(page.getByTestId('wallet-connection-status')).toHaveText('Carteira Conectada')
}

test.describe('Etapa 5 — Checkout, pagamento simulado e confirmação de pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await resetEnvironment(page)
  })

  test('1. abrir o checkout com os dados corretos do carrinho', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)

    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()

    const checkoutBtn = page.getByRole('link', { name: 'Avançar para o pagamento' })
    await expect(checkoutBtn).toBeVisible()
    await checkoutBtn.click()

    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()


    await expect(page.getByTestId('buyer-name-input')).toHaveValue('Ana Silva')
    await expect(page.getByTestId('buyer-email-input')).toHaveValue('ana@exemplo.com')


    await expect(page.getByText('Aurora #017')).toBeVisible()

    await expect(page.getByTestId('order-summary-total')).toContainText('1.2775')
  })

  test('2. validar os campos de comprador obrigatórios', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')


    const nameInput = page.getByTestId('buyer-name-input')
    await nameInput.fill('')


    const confirmBtn = page.getByTestId('confirm-purchase-btn')
    await confirmBtn.click()

    await expect(page.getByText('Nome completo é obrigatório')).toBeVisible()
    await expect(page.getByText('Conecte sua carteira simulada para continuar')).toBeVisible()
  })

  test('3. selecionar carteira e rede simuladas', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')


    const connectBtn = page.getByTestId('connect-wallet-btn')
    await connectBtn.click()

    await expect(page.getByTestId('wallet-connection-status')).toHaveText('Carteira Conectada')
    await expect(page.getByTestId('buyer-wallet-address')).toHaveText('0x71C3...98B2')


    const networkSelect = page.getByTestId('network-select')
    await networkSelect.selectOption('solana')

    await expect(page.getByText(/rede selecionada é incompatível/i)).toBeVisible()
    await expect(page.getByTestId('confirm-purchase-btn')).toBeDisabled()


    await networkSelect.selectOption('polygon')
    await expect(page.getByText(/rede selecionada é incompatível/i)).not.toBeVisible()
    await expect(page.getByTestId('confirm-purchase-btn')).toBeEnabled()
  })

  test('4. impedir a compra com estoque ou cotação inválidos', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: 'nft-aurora-017', available: 0, version: 10 }),
      })
    })

    await page.goto('/carrinho')

    await expect(page.getByRole('button', { name: /ajuste os itens para continuar/i })).toBeDisabled()
  })

  test('5. detectar mudança de preço e solicitar nova confirmação', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')


    await page.getByTestId('connect-wallet-btn').click()
    await expect(page.getByTestId('wallet-connection-status')).toHaveText('Carteira Conectada')


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: 'nft-aurora-017', priceEth: '1.850', version: 5 }),
      })
    })


    await expect(page.getByTestId('quote-change-alert')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('confirm-purchase-btn')).toContainText('Aceite a nova cotação')


    await page.getByTestId('accept-new-quote-btn').click()
    await expect(page.getByTestId('quote-change-alert')).not.toBeVisible()
    await expect(page.getByTestId('confirm-purchase-btn')).toContainText('Confirmar e Finalizar Compra')
  })

  test('6. detectar mudança de estoque antes da compra', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')

    await page.getByTestId('connect-wallet-btn').click()
    await expect(page.getByTestId('wallet-connection-status')).toHaveText('Carteira Conectada')


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: 'nft-aurora-017', available: 0, version: 8 }),
      })
    })

    await expect(page.getByTestId('quote-change-alert')).toBeVisible({ timeout: 10_000 })
  })

  test('7. revalidar cupom, taxas e total', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.goto('/carrinho')
    await page.getByLabel('Cupom de desconto').fill('PROMO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('10% OFF')).toBeVisible()

    await page.goto('/checkout')
    await expect(page.getByText(/desconto.*promo10/i)).toBeVisible()

    await expect(page.getByTestId('order-summary-total')).toContainText('1.15')
  })

  test('8. concluir uma compra após confirmação explícita da simulação de pagamento', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')

    await connectWallet(page)

    const confirmBtn = page.getByTestId('confirm-purchase-btn')
    await confirmBtn.click()


    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
    await expect(page.getByTestId('transaction-hash')).toBeVisible()
    await expect(page.getByTestId('receipt-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toContainText('1.2775')
  })

  test('9. manter o pedido pendente até a confirmação', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/order-payment-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'pending' }),
      })
    })

    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()


    await expect(page.getByTestId('payment-status-pending')).toBeVisible()
    await expect(page.getByText(/aguardando confirmação em tempo real/i)).toBeVisible()
  })

  test('10. tratar pagamento recusado', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/order-payment-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'declined' }),
      })
    })

    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page.getByTestId('payment-declined-alert')).toBeVisible()

    await expect(page.getByTestId('cart-badge-count')).toHaveText('1')
  })

  test('11. impedir pedidos duplicados por duplo clique', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')

    await connectWallet(page)
    const confirmBtn = page.getByTestId('confirm-purchase-btn')


    await confirmBtn.dblclick()


    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
  })

  test('12. recuperar o pedido após timeout posterior à criação no servidor', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/order-timeout-after-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      })
    })

    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()


    await expect(page.getByTestId('checkout-error-alert')).toBeVisible()
    const retryBtn = page.getByTestId('retry-after-timeout-btn')
    await expect(retryBtn).toBeVisible()


    await retryBtn.click()


    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
  })

  test('13. recuperar o mesmo pedido ao repetir a requisição com a mesma chave e payload', async ({ page }) => {
    await loginAsAna(page)

    const result = await page.evaluate(async () => {
      const token = window.localStorage.getItem('nft_auth_token')
      const payload = {
        idempotencyKey: 'idem-test-duplicate-key',
        buyer: {
          name: 'Ana Silva',
          email: 'ana@exemplo.com',
          walletAddress: '0x71C3...98B2',
          network: 'ethereum',
        },
        items: [{ nftId: 'nft-aurora-017', editionId: 'open', quantity: 1, unitPriceEth: '1.275' }],
        subtotalEth: '1.275',
        discountEth: '0',
        networkFeeEth: '0.0025',
        totalEth: '1.2775',
      }

      const res1 = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data1 = await res1.json()

      const res2 = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data2 = await res2.json()

      return { id1: data1.id, id2: data2.id }
    })

    expect(result.id1).toBeTruthy()
    expect(result.id1).toBe(result.id2)
  })

  test('14. rejeitar a mesma chave com payload diferente (HTTP 409)', async ({ page }) => {
    await loginAsAna(page)

    const status = await page.evaluate(async () => {
      const token = window.localStorage.getItem('nft_auth_token')
      const payload1 = {
        idempotencyKey: 'idem-conflict-key',
        buyer: { name: 'Ana Silva', email: 'ana@exemplo.com', walletAddress: '0x123', network: 'ethereum' },
        items: [{ nftId: 'nft-aurora-017', editionId: 'open', quantity: 1, unitPriceEth: '1.275' }],
        subtotalEth: '1.275',
        discountEth: '0',
        networkFeeEth: '0.0025',
        totalEth: '1.2775',
      }
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload1),
      })


      const payload2 = { ...payload1, totalEth: '2.5525' }
      const res2 = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload2),
      })
      return res2.status
    })

    expect(status).toBe(409)
  })

  test('15. recuperar o estado do pedido após atualizar a página', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()


    await page.reload()

    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
    await expect(page.getByTestId('receipt-total')).toContainText('1.2775')
  })

  test('16. receber e aplicar um evento order.updated válido', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/order-payment-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'pending' }),
      })
    })

    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page.getByTestId('payment-status-pending')).toBeVisible()


    await page.evaluate(async () => {
      const stored = JSON.parse(window.localStorage.getItem('nft_mock_store_v1') || '{}')
      const orderIds = Object.keys(stored.orders || {})
      const orderId = orderIds[orderIds.length - 1]
      await fetch('/api/_mock/scenarios/emit-order-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'confirmed',
          transactionHash: '0x1234567890abcdef',
          version: 2,
        }),
      })
    })


    await expect(page).toHaveURL(/\/pedidos\/ord-/, { timeout: 10_000 })
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
  })

  test('17. ignorar eventos duplicados e de versões antigas', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()
    await expect(page).toHaveURL(/\/pedidos\/ord-/)


    const currentUrl = page.url()
    const orderId = currentUrl.split('/pedidos/')[1]

    await page.evaluate(async (oid) => {
      await fetch('/api/_mock/scenarios/emit-order-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: oid,
          status: 'declined', // tentativa de regredir para declined com versão antiga
          version: 1,
        }),
      })
    }, orderId)


    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
  })

  test('18. recuperar o estado do pedido após reconexão', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()


    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })

    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()
  })

  test('19. garantir que somente as quantidades confirmadas sejam removidas do carrinho', async ({ page }) => {
    await loginAsAna(page)


    await addAuroraToCart(page)


    await page.goto('/nfts/nft-flora-006')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await expect(page.getByTestId('cart-badge-count')).toHaveText('2')


    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('order-confirmed-banner')).toBeVisible()


    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('20. verificar que o recibo permanece imutável após alterações no catálogo ou no carrinho', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')
    await connectWallet(page)
    await page.getByTestId('confirm-purchase-btn').click()

    await expect(page).toHaveURL(/\/pedidos\/ord-/)
    await expect(page.getByTestId('receipt-item-subtotal-nft-aurora-017')).toContainText('1.275')


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: 'nft-aurora-017', priceEth: '3.500', version: 20 }),
      })
    })


    await page.reload()


    await expect(page.getByTestId('receipt-item-subtotal-nft-aurora-017')).toContainText('1.275')
    await expect(page.getByTestId('receipt-total')).toContainText('1.2775')
  })

  test('21. tratar expiração da sessão durante o checkout e preservar o contexto de retorno', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()


    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/expire-session', { method: 'POST' })
      const token = window.localStorage.getItem('nft_auth_token')
      const res = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
      }
    })


    await page.waitForURL(/\/login\?redirect=.*checkout/)
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()


    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()


    await page.waitForURL((url) => url.pathname === '/checkout')
    await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()
  })

  test('22. responsividade: telas de checkout e confirmação sem overflow horizontal em 390px, 768px e 1440px', async ({ page }) => {
    await loginAsAna(page)
    await addAuroraToCart(page)

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/checkout')
      await expect(page.getByRole('heading', { name: 'Checkout e Pagamento' })).toBeVisible()

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasOverflow).toBe(false)
    }
  })
})
