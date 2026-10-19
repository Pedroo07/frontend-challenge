import { expect, test } from '@playwright/test'

test('REST e Socket.IO simulados chegam à interface sem falha de execução', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/diagnostic')

  await expect(page.getByTestId('msw-status')).toHaveText('Pronto · interceptação ativa')
  await expect(page.getByTestId('rest-result')).toContainText('nft-marketplace-mock-api')
  await expect(page.getByTestId('socket-status')).toHaveText('Conectado')
  await expect(page.getByTestId('nft-update')).toContainText('nft-aurora-017')
  await expect(page.getByTestId('nft-update')).toContainText('1.275 ETH')
  await expect(page.getByTestId('nft-update')).toContainText('Disponível4')
  await expect(page.getByTestId('nft-update')).toContainText('Versão2')
  expect(pageErrors).toEqual([])
})
