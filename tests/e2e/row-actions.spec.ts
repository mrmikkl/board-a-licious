import { expect, test } from '@playwright/test'

import { expectAccessible, seedCollection, unique } from './helpers.ts'

// F005 US1 (contracts/ui.md "Collection screen", "Sheets"): a game row carries its own Buy and Category actions
const CASCADIA = { bggId: 295947, name: 'Cascadia', mark: 'interested' }

test.beforeEach(async ({ page }) => {
  await seedCollection(page, unique('Row actions'), [CASCADIA, { bggId: 1101, name: 'Quill Harbour', mark: 'must_have' }])
})

test('a row has its own Buy and Category actions and no mark pill', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Buy Cascadia' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Category of Cascadia' })).toBeVisible()
  await expect(page.locator('.mark-pill')).toHaveCount(0)
  // the row's open button names the game, its category and whether it is bought
  await expect(page.getByRole('button', { name: 'Cascadia, Interested', exact: true })).toBeVisible()
})

test('Buy opens the Buy sheet; Got it marks the game bought with the price paid', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy Cascadia' }).click()
  const sheet = page.getByRole('dialog', { name: 'Bought Cascadia' })
  await sheet.getByLabel('What did you pay?').fill('25')
  await sheet.getByRole('button', { name: 'Got it' }).click()
  await expect(page.getByRole('status')).toHaveText('Cascadia: got it for €25!')
  const bought = page.getByRole('button', { name: 'Not bought Cascadia' })
  await expect(bought).toHaveAttribute('aria-pressed', 'true')
  await expect(bought).toContainText('€25')
  await expect(page.getByRole('button', { name: 'Cascadia, Interested, bought', exact: true })).toBeVisible()
})

test('Buy on a bought game un-buys it at once, with no sheet', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy Cascadia' }).click()
  await page.getByRole('dialog', { name: 'Bought Cascadia' }).getByRole('button', { name: 'Got it' }).click()
  await page.getByRole('button', { name: 'Not bought Cascadia' }).click()
  await expect(page.getByRole('status')).toHaveText('Cascadia: not bought any more')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Buy Cascadia' })).toHaveAttribute('aria-pressed', 'false')
})

test('Category opens the Category sheet; a choice moves the row to its group', async ({ page }) => {
  await page.getByRole('button', { name: 'Category of Cascadia' }).click()
  const sheet = page.getByRole('dialog', { name: 'Category of Cascadia' })
  await expect(sheet.getByRole('button')).toHaveCount(7)
  await expect(sheet.getByRole('button', { name: '👀 Interested' })).toHaveAttribute('aria-pressed', 'true')
  await sheet.getByRole('button', { name: '⭐ Must Have' }).click()
  await expect(page.getByRole('status')).toHaveText('Cascadia → ⭐ Must Have')
  await expect(page.locator('.row[data-mark="must_have"]').getByRole('button', { name: 'Cascadia, Must Have', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Category of Cascadia' })).toBeVisible()
})

test('both sheets pass axe', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy Cascadia' }).click()
  await expect(page.getByRole('dialog', { name: 'Bought Cascadia' })).toBeVisible()
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Category of Cascadia' }).click()
  await expect(page.getByRole('dialog', { name: 'Category of Cascadia' })).toBeVisible()
  await expectAccessible(page)
})
