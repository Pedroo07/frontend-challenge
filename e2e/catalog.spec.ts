import { expect, test } from '@playwright/test'

test('o catálogo apresenta NFTs vindos da API simulada', async ({ page }) => {
  const listRequestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/nfts')
  await page.goto('/')

  const listRequest = await listRequestPromise
  const params = new URL(listRequest.url()).searchParams
  expect(params.get('sort')).toBe('newest')
  expect(params.get('page')).toBe('1')
  expect(params.get('pageSize')).toBe('9')

  await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver detalhes de / })).toHaveCount(9)
})

test('busca, coleção, disponibilidade e ordenação atualizam a URL e a consulta', async ({ page }) => {
  const requests: URL[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/nfts') requests.push(url)
  })

  await page.goto('/?page=2')
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #009' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Coleção' }).selectOption('aurora')
  await expect(page).toHaveURL(/collection=aurora/)
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByText('4 obras encontradas')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Somente disponíveis' }).check()
  await expect(page).toHaveURL(/available=true/)

  await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('price-desc')
  await expect(page).toHaveURL(/sort=price-desc/)
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #009' })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Lena')
  await expect(page).toHaveURL(/q=Lena/)
  await expect(page.getByText('4 obras encontradas')).toBeVisible()

  const request = requests.at(-1)
  expect(request?.searchParams.get('q')).toBe('Lena')
  expect(request?.searchParams.get('collection')).toBe('aurora')
  expect(request?.searchParams.get('available')).toBe('true')
  expect(request?.searchParams.get('sort')).toBe('price-desc')
  expect(request?.searchParams.get('page')).toBe('1')
})

test('paginação, histórico e refresh restauram o catálogo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #009' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #009' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #009' })).toBeVisible()

  const search = page.getByRole('searchbox', { name: 'Buscar NFTs' })
  await search.fill('Aurora')
  await expect(page).toHaveURL(/q=Aurora/)
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(search).toHaveValue('')
  await page.goForward()
  await expect(search).toHaveValue('Aurora')
})

test('o detalhe direto respeita o limite de quantidade da edição', async ({ page }) => {
  await page.goto('/nfts/nft-aurora-017')

  await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
  await expect(page.getByText('Lena Volkov')).toBeVisible()
  await expect(page.getByRole('button', { name: /Edição aberta/ })).toContainText('1.275 ETH')

  const quantity = page.getByRole('spinbutton', { name: 'Quantidade' })
  await quantity.fill('99')
  await expect(quantity).toHaveValue('4')
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Prova de artista/ })).toBeDisabled()
})

test('a edição selecionada aplica seu próprio limite de disponibilidade', async ({ page }) => {
  await page.goto('/nfts/nft-afterlight-022')
  await expect(page.getByRole('heading', { name: 'Afterlight #022' })).toBeVisible()

  const proofEdition = page.getByRole('button', { name: /Prova de artista/ })
  await expect(proofEdition).toBeEnabled()
  await proofEdition.click()
  const quantity = page.getByRole('spinbutton', { name: 'Quantidade' })
  await expect(quantity).toHaveAttribute('max', '1')
  await quantity.fill('5')
  await expect(quantity).toHaveValue('1')
})

test('uma rota de NFT inexistente apresenta um estado 404 recuperável', async ({ page }) => {
  await page.goto('/nfts/nft-inexistente')

  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explorar catálogo' })).toBeVisible()
})

test('parâmetros inválidos recebem filtros e paginação seguros', async ({ page }) => {
  const listRequestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/nfts')
  await page.goto('/?page=0&sort=impossible&available=yes&collection=unknown')
  const request = await listRequestPromise
  const params = new URL(request.url()).searchParams

  expect(params.get('page')).toBe('1')
  expect(params.get('sort')).toBe('newest')
  expect(params.has('available')).toBe(false)
  expect(params.has('collection')).toBe(false)
  await expect(page.getByRole('combobox', { name: 'Coleção' })).toHaveValue('all')
  await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('newest')
  await expect(page.getByRole('checkbox', { name: 'Somente disponíveis' })).not.toBeChecked()
})

test('um erro transitório permite tentar carregar o catálogo novamente', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()

  const scenarioSucceeded = await page.evaluate(async () => {
    const response = await fetch('/api/_mock/scenarios/nft-list-error-once', { method: 'POST' })
    return response.ok
  })
  expect(scenarioSucceeded).toBe(true)
  await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('Aurora')

  await expect(page.getByRole('alert')).toContainText('Não foi possível atualizar o catálogo')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByText('4 obras encontradas')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver detalhes de Aurora #017' })).toBeVisible()
})

test('catálogo e detalhe não criam overflow horizontal nos tamanhos previstos', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Peças em destaque' })).toBeVisible()
    const catalogOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(catalogOverflows, `catálogo em ${width}px`).toBe(false)

    await page.goto('/nfts/nft-aurora-017')
    await expect(page.getByRole('heading', { name: 'Aurora #017' })).toBeVisible()
    const detailOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(detailOverflows, `detalhe em ${width}px`).toBe(false)
  }
})
