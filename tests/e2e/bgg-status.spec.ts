import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  expectAccessible,
  fakeBggAccount,
  fakeBggCollection,
  fakeNoGameDetails,
  keepBggSettingsLocal,
  seedCollection,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F008 US4 (spec.md, docs/design.md "BGG status section"): change a game's statuses on BoardGameGeek. */
const MINE: FakeCollectionItem[] = [{ bggId: 7201, name: 'Harbour Lights', year: 2024, status: { own: true, wantToPlay: true, forTrade: true } }]
const SHOPPING = [
  { bggId: 7201, name: 'Harbour Lights', mark: 'must_have' },
  { bggId: 7202, name: 'Copper Valley', mark: 'interested' },
]

async function open(page: Page, game: string, account: Parameters<typeof fakeBggAccount>[1] = { signedIn: true }) {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  await fakeBggAccount(page, { statuses: { 7201: MINE[0]!.status! }, ...account })
  await setBggUsername(page, 'mrmikkl')
  await seedCollection(page, unique('Statuses'), SHOPPING)
  await page.getByRole('button', { name: new RegExp(`^${game},`) }).click()
  return page.getByRole('dialog', { name: game })
}

const section = (sheet: ReturnType<Page['getByRole']>) => sheet.getByRole('button', { name: /^BGG status/ })
const save = (sheet: ReturnType<Page['getByRole']>) => sheet.getByRole('button', { name: 'Save on BoardGameGeek' })

test('the folded section shows badges in its header; switches by status, Wishlist priority, changed lines', async ({ page }) => {
  const sheet = await open(page, 'Harbour Lights')
  await expect(section(sheet)).toHaveAttribute('aria-expanded', 'false')
  await expect(section(sheet).locator('.bb')).toHaveText(['Owned', 'Want to play', '+1'])
  await section(sheet).click()
  await expect(section(sheet)).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.getByText('Signed in as mrmikkl. Only what you change is written.')).toBeVisible()
  for (const name of ['Owned', 'Preordered', 'Wishlist', 'Want to play', 'For trade', 'Want in trade', 'Want to buy', 'Previously owned'])
    await expect(sheet.getByRole('checkbox', { name, exact: true })).toBeVisible()
  await expect(sheet.getByRole('checkbox', { name: 'Owned', exact: true })).toBeChecked()
  await expect(save(sheet)).toBeDisabled()
  await expectAccessible(page)

  await sheet.getByRole('checkbox', { name: 'Wishlist', exact: true }).check()
  const priority = sheet.getByRole('group', { name: 'Wishlist priority' })
  await expect(priority.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true')
  await expect(sheet.getByText('3 · Like to have')).toBeVisible()
  await priority.getByRole('button', { name: '2' }).click()
  await expect(sheet.getByText('2 · Love to have')).toBeVisible()
  await expect(sheet.locator('.st-line.changed')).toHaveCount(1)
  await expect(sheet.getByText('· changed')).toHaveCount(1)
  await expect(save(sheet)).toBeEnabled()
  await expectAccessible(page)
})

test('saving sends only the changed keys; toast and badges update without a reload', async ({ page }) => {
  const saves: unknown[] = []
  const sheet = await open(page, 'Harbour Lights', { signedIn: true, saves })
  await section(sheet).click()
  await sheet.getByRole('checkbox', { name: 'For trade', exact: true }).uncheck()
  await sheet.getByRole('checkbox', { name: 'Wishlist', exact: true }).check()
  await save(sheet).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek' })).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(saves).toEqual([{ status: { forTrade: false, wishlist: 3 } }])
  const row = page.locator('.row').filter({ has: page.getByRole('button', { name: /^Harbour Lights,/ }) })
  await expect(row.getByLabel('On BoardGameGeek: Owned, Wishlist 3, Want to play')).toBeVisible()
})

test('a game not in the collection can be added; a refused save keeps the choices with Try again', async ({ page }) => {
  const saves: unknown[] = []
  const sheet = await open(page, 'Copper Valley', { signedIn: true, saves, saveStatus: 502 })
  await expect(section(sheet)).toContainText('not in your collection')
  await section(sheet).click()
  await sheet.getByRole('checkbox', { name: 'Want to play', exact: true }).check()
  await save(sheet).click()
  await expect(sheet.getByText('BoardGameGeek did not take the change. Nothing was changed.')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(sheet.getByRole('checkbox', { name: 'Want to play', exact: true })).toBeChecked()
  await expect(section(sheet)).toContainText('not in your collection')
  expect(saves).toEqual([{ status: { wantToPlay: true } }])
  await expectAccessible(page)
})

test('not signed in: Sign in to save opens the sign-in sheet and returns with the draft', async ({ page }) => {
  const saves: unknown[] = []
  const sheet = await open(page, 'Harbour Lights', { signedIn: false, saves })
  await section(sheet).click()
  await expect(sheet.getByText('Sign in to BoardGameGeek to change them.')).toBeVisible()
  await sheet.getByRole('checkbox', { name: 'Preordered', exact: true }).check()
  await sheet.getByRole('button', { name: 'Sign in to save on BoardGameGeek' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in to BoardGameGeek' })
  await signIn.getByLabel('Password').fill('secret')
  await signIn.getByRole('button', { name: 'Sign in', exact: true }).click()
  const back = page.getByRole('dialog', { name: 'Harbour Lights' })
  await expect(section(back)).toHaveAttribute('aria-expanded', 'true')
  await expect(back.getByRole('checkbox', { name: 'Preordered', exact: true })).toBeChecked()
  await save(back).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek' })).toBeVisible()
  expect(saves).toEqual([{ status: { preordered: true } }])
})

test('offline the switches are disabled with one line why', async ({ page, context }) => {
  const sheet = await open(page, 'Harbour Lights')
  await context.setOffline(true)
  await section(sheet).click()
  await expect(sheet.getByText('Changing statuses needs a connection.')).toBeVisible()
  await expect(sheet.getByRole('checkbox', { name: 'Owned', exact: true })).toBeDisabled()
  await expect(save(sheet)).toBeDisabled()
  await context.setOffline(false)
})
