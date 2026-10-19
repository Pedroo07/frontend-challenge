import { expect, test } from '@playwright/test'

test.describe('Carrinho, cotações e Socket.IO em tempo real', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
    await page.evaluate(async () => {
      window.localStorage.removeItem('nft_auth_token')
      window.localStorage.removeItem('nft_guest_cart_id')
      window.sessionStorage.clear()
      await fetch('/api/_mock/scenarios/reset', { method: 'POST' })
    })
  })

  test('1. adicionar item ao carrinho a partir da página de detalhes', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()

    const addBtn = page.getByRole('button', { name: /adicionar.*ao carrinho/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    await expect(page.getByRole('status')).toContainText('adicionado ao carrinho')
    await expect(page.getByTestId('cart-badge-count')).toHaveText('1')

    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('1')
  })

  test('2. atualizar quantidade de item no carrinho respeitando subtotal e cotação', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    const item = page.getByTestId('cart-item-nft-aurora-017')
    await expect(item).toBeVisible()
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('1')

    // Clica no botão + para aumentar quantidade
    const plusBtn = item.getByRole('button', { name: /aumentar quantidade/i })
    await plusBtn.click()

    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('2')
    // 2 x 1.275 = 2.550 ETH
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('2.55')

    // Clica no botão − para diminuir
    const minusBtn = item.getByRole('button', { name: /diminuir quantidade/i })
    await minusBtn.click()

    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('1')
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('1.275')
  })

  test('3. impedir quantidade superior ao estoque disponível', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    // Aurora #017 possui estoque de 4 unidades na edição aberta
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    const item = page.getByTestId('cart-item-nft-aurora-017')
    const plusBtn = item.getByRole('button', { name: /aumentar quantidade/i })

    // Aumenta até 4
    await plusBtn.click() // 2
    await plusBtn.click() // 3
    await plusBtn.click() // 4
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('4')

    // O botão + deve estar desabilitado no limite de estoque
    await expect(plusBtn).toBeDisabled()
  })

  test('4. remover item e apresentar estado de carrinho vazio', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()

    const removeBtn = page.getByRole('button', { name: /remover aurora #017/i })
    await removeBtn.click()

    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar catálogo' })).toBeVisible()
  })

  test('5. persistir o carrinho após atualizar a página (reload)', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('1')
  })

  test('6. preservar e mesclar itens de visitante após login', async ({ page }) => {
    // 1. Visitante adiciona item ao carrinho
    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await expect(page.getByTestId('cart-badge-count')).toHaveText('1')

    // 2. Faz login na conta de Ana Silva
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/(?:\?.*)?$/)
    await expect(page.getByTestId('user-name')).toHaveText('Ana Silva')

    // 3. Acessa o carrinho e verifica que o item do visitante foi preservado
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('1')
  })

  test('7. evitar vazamento do carrinho privado na troca de usuário', async ({ page }) => {
    // 1. Login como Ana e adiciona item
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/(?:\?.*)?$/)

    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()

    // 2. Logout
    await page.getByRole('button', { name: 'Sair' }).click()

    // 3. Verifica que o visitante não herdou o carrinho da Ana
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()

    // 4. Login como Lucas e verifica que não vê os itens de Ana
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@exemplo.com')
    await page.getByLabel('Senha').fill('Password123!')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/(?:\?.*)?$/)

    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('8. aplicar cupom válido reduz o total da cotação', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    // Preço 1.275 + Taxa 0.0025 = 1.2775 ETH
    await expect(page.getByTestId('quote-total')).toContainText('1.2775')

    // Aplica cupom PROMO10 (10% de desconto sobre subtotal 1.275 = 0.1275)
    // Total esperado: 1.275 - 0.1275 + 0.0025 = 1.1500 ETH
    await page.getByLabel('Cupom de desconto').fill('PROMO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()

    await expect(page.getByText(/10% OFF/i)).toBeVisible()
    await expect(page.getByTestId('quote-total')).toContainText('1.15')
  })

  test('9. rejeitar cupom inválido ou expirado com feedback acessível', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')
    await expect(page.getByTestId('quote-total')).toBeVisible()

    // Cupom inválido
    await page.getByLabel('Cupom de desconto').fill('CUPOMINVALIDO')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert')).toContainText('Cupom inválido.')

    // Cupom expirado
    await page.getByLabel('Cupom de desconto').fill('EXPIRED50')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert')).toContainText('Cupom expirado.')
  })

  test('10. calcular subtotal, desconto, taxas e total com precisão decimal em ETH', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    // Adiciona 2 unidades: unit 1.275 * 2 = 2.550
    const plusBtn = page.getByRole('button', { name: 'Aumentar quantidade' })
    await plusBtn.click()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await expect(page.getByRole('status')).toContainText(/adicionado.*ao carrinho/i)

    await page.goto('/carrinho')
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('2.55')

    // Aplica CRYPTO20: 20% sobre 2.55 = 0.51
    // Total = 2.55 - 0.51 + 0.0025 = 2.0425 ETH
    await page.getByLabel('Cupom de desconto').fill('CRYPTO20')
    await page.getByRole('button', { name: 'Aplicar' }).click()

    await expect(page.getByTestId('quote-total')).toContainText('2.0425')
  })

  test('11. tratar erro transitório na cotação e permitir nova tentativa', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await expect(page.getByRole('status')).toContainText(/adicionado.*ao carrinho/i)
    await page.goto('/carrinho')
    await expect(page.getByTestId('quote-total')).toContainText('1.2775')

    // Força falha transitória na próxima cotação
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/cart-quote-error-once', { method: 'POST' })
    })

    // Altera quantidade para disparar novo cálculo de cotação
    const plusBtn = page.getByRole('button', { name: /aumentar quantidade/i })
    await plusBtn.click()

    await expect(page.getByRole('alert')).toContainText('Falha ao calcular cotação.')

    // Clica em Tentar novamente
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('quote-total')).toBeVisible()
  })

  test('12. atualizar a cotação após mudança de preço via Socket.IO', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    // Preço original: 1.275 ETH + taxa 0.0025 = 1.2775 ETH
    await expect(page.getByTestId('quote-total')).toContainText('1.2775')

    // Dispara evento nft.updated via Socket.IO simulado pelo MSW
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'nft-aurora-017',
          priceEth: '1.850',
          available: 4,
          version: 3,
        }),
      })
    })

    // Interface e cotação devem refletir a nova versão
    await expect(page.getByText('Preço alterado')).toBeVisible()
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('1.85')
    // 1.850 + 0.0025 = 1.8525 ETH
    await expect(page.getByTestId('quote-total')).toContainText('1.8525')
  })

  test('13. atualizar a disponibilidade após mudança de estoque via Socket.IO', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    const plusBtn = page.getByRole('button', { name: 'Aumentar quantidade' })
    await plusBtn.click() // Quantidade 2
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()

    await page.goto('/carrinho')
    await expect(page.getByTestId('item-qty-nft-aurora-017')).toHaveText('2')

    // Reduz estoque para 1 via Socket.IO
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'nft-aurora-017',
          priceEth: '1.275',
          available: 1,
          version: 4,
        }),
      })
    })

    // Deve indicar estoque insuficiente e bloquear avanço
    await expect(page.getByText(/Apenas 1 disp/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ajuste os itens para continuar' })).toBeDisabled()
  })

  test('14. ignorar eventos de Socket.IO com versões antigas ou duplicadas', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('quote-total')).toContainText('1.2775')

    // Emite versão 5 com preço 2.000
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'nft-aurora-017',
          priceEth: '2.000',
          available: 4,
          version: 5,
        }),
      })
    })
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('2.00')

    // Tenta emitir versão antiga 4 com preço 0.500
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'nft-aurora-017',
          priceEth: '0.500',
          available: 4,
          version: 4,
        }),
      })
    })

    // O preço NÃO deve regredir
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('2.00')
  })

  test('15. recuperar o estado atualizado após recarga da página', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item-nft-aurora-017')).toBeVisible()
    await expect(page.getByTestId('quote-total')).toContainText('1.2775')

    // Atualiza preço
    await page.evaluate(async () => {
      await fetch('/api/_mock/scenarios/emit-nft-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'nft-aurora-017',
          priceEth: '1.500',
          available: 4,
          version: 6,
        }),
      })
    })
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('1.50')

    // Recarrega a página
    await page.reload()

    // O estado persistido na API REST deve ser restabelecido
    await expect(page.getByTestId('item-subtotal-nft-aurora-017')).toContainText('1.50')
  })

  test('responsividade: tela do carrinho não gera overflow horizontal em 390px, 768px e 1440px', async ({ page }) => {
    await page.goto('/nfts/nft-aurora-017')
    await page.getByRole('button', { name: /adicionar.*ao carrinho/i }).click()
    await page.goto('/carrinho')

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(100)
      const hasHorizontalScrollbar = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(hasHorizontalScrollbar).toBeFalsy()
    }
  })
})
