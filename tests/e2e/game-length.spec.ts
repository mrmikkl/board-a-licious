import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, keepBggSettingsLocal } from './helpers.ts'

/** F009 US3 (spec.md, docs/design.md "Game length"): Config › Game length, synced like the BGG username. */

/** Opens Config with the settings kept on this device; returns the settings each push to /api/sync carried. */
async function config(page: Page) {
  await keepBggSettingsLocal(page)
  const pushed: unknown[] = []
  // registered after keepBggSettingsLocal, so it sees the push first and then hands it on
  await page.route('**/api/sync**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { settings?: unknown[] }
      pushed.push(...(body.settings ?? []))
    }
    await route.fallback()
  })
  await page.goto('/#/config')
  await expect(page.getByRole('heading', { name: 'Game length' })).toBeVisible()
  return pushed
}

const section = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Game length' }) })
const field = (page: Page, name: 'Short' | 'Middle' | 'Long') => page.getByRole('textbox', { name: `${name} ends at minutes` })

test('Config › Game length shows the four lengths with their defaults', async ({ page }) => {
  await config(page)
  const length = section(page)
  await expect(length.getByText('Short', { exact: true })).toBeVisible()
  await expect(length.getByText('0–30 min')).toBeVisible()
  await expect(length.getByText('31–60 min')).toBeVisible()
  await expect(length.getByText('61–120 min')).toBeVisible()
  await expect(length.getByText('Very long', { exact: true })).toBeVisible()
  await expect(length.getByText('121+ min')).toBeVisible()
  await expect(field(page, 'Short')).toHaveValue('30')
  await expect(field(page, 'Middle')).toHaveValue('60')
  await expect(field(page, 'Long')).toHaveValue('120')
  await expect(length.getByRole('textbox')).toHaveCount(3)
  await expect(section(page).getByRole('button', { name: 'Reset', exact: true })).toBeDisabled()
  await expectAccessible(page)
})

test('a new end updates the range texts, saves with a toast, syncs and stays after a reload', async ({ page }) => {
  const pushed = await config(page)
  await field(page, 'Short').fill('45')
  const length = section(page)
  await expect(length.getByText('0–45 min')).toBeVisible()
  await expect(length.getByText('46–60 min')).toBeVisible()
  await expect(section(page).getByRole('button', { name: 'Reset', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Save game length' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved the game length' })).toBeVisible()
  await expect.poll(() => pushed.some(s => JSON.stringify((s as { lengthLimits?: unknown }).lengthLimits) === '[45,60,120]')).toBe(true)

  await page.reload()
  await expect(field(page, 'Short')).toHaveValue('45')
  await expect(section(page).getByText('46–60 min')).toBeVisible()
})

test('lengths that do not increase show the error line and disable Save', async ({ page }) => {
  await config(page)
  await field(page, 'Middle').fill('20')
  await expect(page.getByText('Each length must end after the one before.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save game length' })).toBeDisabled()
  await field(page, 'Middle').fill('90')
  await expect(page.getByText('Each length must end after the one before.')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save game length' })).toBeEnabled()
})

test('Reset goes back to 30 / 60 / 120 and is disabled there', async ({ page }) => {
  await config(page)
  await field(page, 'Long').fill('180')
  await page.getByRole('button', { name: 'Save game length' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved the game length' })).toBeVisible()
  const reset = section(page).getByRole('button', { name: 'Reset', exact: true })
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(field(page, 'Long')).toHaveValue('120')
  await expect(section(page).getByText('61–120 min')).toBeVisible()
  await expect(reset).toBeDisabled()
  await page.getByRole('button', { name: 'Save game length' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved the game length' })).toBeVisible()
  await page.reload()
  await expect(field(page, 'Long')).toHaveValue('120')
})
