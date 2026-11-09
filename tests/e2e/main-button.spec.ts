import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  createCollection,
  expectAccessible,
  fakeBggAccount,
  fakeBggCollection,
  fakeNoGameDetails,
  keepBggSettingsLocal,
  mainButton,
  openTab,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F009 T020, design rules 3.3.0 "Main button": a short caption inside the hexagon under its icon; the name stays the sentence. */
async function expectCaption(page: Page, caption: string, name: string) {
  const button = mainButton(page)
  await expect(button).toHaveAccessibleName(name)
  const label = button.locator('.main-label')
  await expect(label).toBeVisible()
  await expect(label).toHaveText(caption)
  await expect(label).toHaveAttribute('aria-hidden', 'true')
  // inside the 68×76 hexagon, under the 24 px icon
  const hex = (await button.boundingBox())!
  const text = (await label.boundingBox())!
  const icon = (await button.locator('svg').first().boundingBox())!
  expect(Math.round(hex.width)).toBe(68)
  expect(Math.round(hex.height)).toBe(76)
  expect(Math.round(icon.width)).toBe(24)
  expect(text.x).toBeGreaterThanOrEqual(hex.x)
  expect(text.x + text.width).toBeLessThanOrEqual(hex.x + hex.width)
  expect(text.y).toBeGreaterThanOrEqual(icon.y + icon.height - 1)
  expect(text.y + text.height).toBeLessThanOrEqual(hex.y + hex.height)
  // no active dot unless a filter is set
  await expect(button.locator('.main-dot')).toHaveCount(0)
}

test('Buy › Shopping lists: New list; a shopping list: Tinder', async ({ page }) => {
  await page.goto('/#/buy/lists')
  await expectCaption(page, 'New list', 'Create a shopping list')
  await expectAccessible(page)

  await createCollection(page, unique('Captions'))
  await expectCaption(page, 'Tinder', 'BG-Tinder: swipe a BGG list into this shopping list')
  await expectAccessible(page)
})

test('Lists: Load list on every tab', async ({ page }) => {
  await page.goto('/#/lists')
  for (const tab of ['Status lists', 'Previews', 'Geeklists'] as const) {
    await openTab(page, tab)
    await expectCaption(page, 'Load list', 'Load a BGG list')
  }
  await expectAccessible(page)
})

const MINE: FakeCollectionItem[] = [{ bggId: 295947, name: 'Cascadia', year: 2021, status: { own: true } }]

test('an own status list: Add game', async ({ page }) => {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  await fakeBggAccount(page, { statuses: { 295947: MINE[0]!.status! }, signedIn: true })
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('heading', { level: 1, name: 'Owned' })).toBeVisible()
  await expectCaption(page, 'Add game', 'Add a game to Owned')
  await expectAccessible(page)
})
