import { expect, test } from '@playwright/test'

test.describe('NanoHub public routes', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SolanaOS/)
  })

  test('launch page has boot sequence', async ({ page }) => {
    await page.goto('/launch')
    await expect(page.locator('text=SolanaOS')).toBeVisible()
  })

  test('skills page loads skill cards', async ({ page }) => {
    await page.goto('/skills')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('agents page loads directory', async ({ page }) => {
    await page.goto('/agents')
    await expect(page.locator('text=Registered')).toBeVisible()
  })

  test('IPFS Hub page renders', async ({ page }) => {
    await page.goto('/ipfs')
    await expect(page.locator('text=Private IPFS')).toBeVisible()
    await expect(page.locator('text=Wallet-Scoped')).toBeVisible()
    await expect(page.locator('text=Mainnet Deploy')).toBeVisible()
    await expect(page.locator('text=Mesh Sync')).toBeVisible()
  })

  test('IPFS Hub shows wallet input', async ({ page }) => {
    await page.goto('/ipfs')
    const input = page.locator('input[placeholder*="wallet"]')
    await expect(input).toBeVisible()
  })

  test('mining page renders', async ({ page }) => {
    await page.goto('/mining')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('strategy page renders', async ({ page }) => {
    await page.goto('/strategy')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('pair page renders', async ({ page }) => {
    await page.goto('/pair')
    await expect(page).toHaveTitle(/SolanaOS/)
  })
})
