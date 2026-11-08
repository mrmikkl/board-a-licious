import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  type FakeResult,
  createCollection,
  expectAccessible,
  fakeBggAccount,
  fakeBggCollection,
  fakeNoGameDetails,
  fakeSearch,
  keepBggSettingsLocal,
  mainButton,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F008 feedback (2026-11-08): a status list has a name filter, its main action adds a game to that status on BGG, and Add uses the folded category. */
const MINE: FakeCollectionItem[] = [
  { bggId: 295947, name: 'Cascadia', year: 2021, status: { own: true, wantToPlay: true } },
  { bggId: 342942, name: 'Ark Nova', year: 2021, status: { own: true } },
]
const HARMONIES: FakeResult = { bggId: 414317, name: 'Harmonies', year: 2024, kind: 'boardgame' }
const CASCADIA: FakeResult = { bggId: 295947, name: 'Cascadia', year: 2021, kind: 'boardgame' }

async function openOwned(page: Page, account: Parameters<typeof fakeBggAccount>[1] = { signedIn: true }) {
  await keepBggSettingsLocal(page)
  await fakeSearch(page, { results: { harmon: [HARMONIES], cascad: [CASCADIA] } })
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  await fakeBggAccount(page, { statuses: { 295947: MINE[0]!.status!, 342942: MINE[1]!.status! }, ...account })
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('heading', { level: 1, name: 'Owned' })).toBeVisible()
}

test('the name filter narrows a status list', async ({ page }) => {
  await openOwned(page)
  await expect(page.locator('.row-name')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Filter this list' }).fill('ark')
  await expect(page.locator('.row-name')).toHaveText(['Ark Nova'])
  await page.getByRole('searchbox', { name: 'Filter this list' }).fill('zzz')
  await expect(page.getByText('No game on this list matches.')).toBeVisible()
  await expectAccessible(page)
})

test('the main action adds a game to Owned on BGG and keeps its other statuses', async ({ page }) => {
  const saves: unknown[] = []
  await openOwned(page, { signedIn: true, saves })
  await expect(mainButton(page)).toHaveAccessibleName('Add a game to Owned')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'Add a game to Owned' })
  await sheet.getByRole('searchbox', { name: 'Game name' }).fill('harmon')
  await expectAccessible(page)
  await sheet.getByRole('button', { name: /^Harmonies/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek: Harmonies → Owned' })).toBeVisible()
  expect(saves).toEqual([{ status: { own: true } }])
  await expect(page.getByRole('button', { name: 'Harmonies, 2024' })).toBeVisible()
})

test('a game already on the list is not saved again', async ({ page }) => {
  const saves: unknown[] = []
  await openOwned(page, { signedIn: true, saves })
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'Add a game to Owned' })
  await sheet.getByRole('searchbox', { name: 'Game name' }).fill('cascad')
  await sheet.getByRole('button', { name: /^Cascadia/ }).click()
  await expect(sheet.getByRole('alert')).toHaveText('Cascadia is already on Owned.')
  expect(saves).toEqual([])
})

test('not signed in: picking a game asks to sign in, then saves', async ({ page }) => {
  const saves: unknown[] = []
  await openOwned(page, { signedIn: false, saves })
  await mainButton(page).click()
  await page.getByRole('dialog', { name: 'Add a game to Owned' }).getByRole('searchbox', { name: 'Game name' }).fill('harmon')
  await page.getByRole('dialog', { name: 'Add a game to Owned' }).getByRole('button', { name: /^Harmonies/ }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in to BoardGameGeek' })
  await signIn.getByLabel('BGG username').fill('mrmikkl')
  await signIn.getByLabel('Password').fill('secret')
  await signIn.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek: Harmonies → Owned' })).toBeVisible()
  expect(saves).toEqual([{ status: { own: true } }])
})

test("a row's Add picks the category in a folded section, not a hexagon picker", async ({ page }) => {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  const name = unique('Wishes')
  await createCollection(page, name)
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
  await page.goto('/#/lists/status/mrmikkl/own')
  await page.getByRole('button', { name: 'Add Ark Nova to shopping lists' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add Ark Nova' })
  await sheet.getByRole('checkbox', { name }).check()
  await expect(sheet.getByRole('group', { name: 'Category' })).toHaveCount(0)
  const category = sheet.getByRole('button', { name: /^Category when added/ })
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await category.click()
  await sheet.getByRole('button', { name: /Must Have/ }).click()
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await expect(category).toContainText('Must Have')
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Added Ark Nova to 1 shopping list' })).toBeVisible()
})

test('the game sheet shows the description short in the info box, with Show more / Show less', async ({ page }) => {
  const long = 'A long description. '.repeat(20).trim()
  await keepBggSettingsLocal(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  await page.route('**/api/bgg/games?**', route =>
    route.fulfill({ json: { games: [{ bggId: 342942, name: 'Ark Nova', year: 2021, thumbnailUrl: null, description: long, kind: 'boardgame', publisher: 'Feuerland' }] } }),
  )
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
  await page.goto('/#/lists/status/mrmikkl/own')
  await page.getByRole('button', { name: 'Ark Nova, 2021' }).click()
  const box = page.getByRole('dialog', { name: 'Ark Nova' }).locator('.facts-box')
  await expect(box.locator('.info-desc p')).toHaveText(/…$/)
  await expect(box.locator('.info-desc p')).not.toHaveText(long)
  await box.getByRole('button', { name: 'Show more' }).click()
  await expect(box.locator('.info-desc p')).toHaveText(long)
  await box.getByRole('button', { name: 'Show less' }).click()
  await expect(box.locator('.info-desc p')).toHaveText(/…$/)
  await expectAccessible(page)
})
