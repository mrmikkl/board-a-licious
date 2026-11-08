import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  expectAccessible,
  fakeBggAccount,
  fakeBggCollection,
  fakeNoGameDetails,
  fakeSearch,
  keepBggSettingsLocal,
  seedCollection,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F008 US5 (spec.md, docs/design.md "Mark as owned sheet"): buying updates BoardGameGeek. */
const MINE: FakeCollectionItem[] = [{ bggId: 7301, name: 'Harbour Lights', year: 2024, status: { own: true } }]
const SHOPPING = [
  { bggId: 7301, name: 'Harbour Lights', mark: 'must_have', priceCents: 4500 },
  { bggId: 7302, name: 'Copper Valley', mark: 'interested', booth: '3-A101', priceCents: 4500 },
]

const pad = (n: number) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function setUp(page: Page, account: Parameters<typeof fakeBggAccount>[1]) {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE })
  await fakeBggAccount(page, account)
  await setBggUsername(page, 'mrmikkl')
}

async function buyInList(page: Page, game: string) {
  await seedCollection(page, unique('Bought'), SHOPPING)
  await page.getByRole('button', { name: `Buy ${game}` }).click()
  await page.getByRole('dialog', { name: `Bought ${game}?` }).getByRole('button', { name: 'Got it' }).click()
}

const ownSheet = (page: Page) => page.getByRole('dialog', { name: 'Also mark as owned on BoardGameGeek?' })
const row = (page: Page, name: string) => page.locator('.row').filter({ has: page.getByRole('button', { name: new RegExp(`^${name},`) }) })

test('after Got it on a game not owned the sheet lists what is written; Not now writes nothing', async ({ page }) => {
  const saves: unknown[] = []
  await setUp(page, { signedIn: true, saves })
  await buyInList(page, 'Copper Valley')
  const sheet = ownSheet(page)
  await expect(sheet.getByText('Copper Valley is not in your owned games on BoardGameGeek yet.')).toBeVisible()
  const written = sheet.locator('dl')
  await expect(written.locator('dt')).toHaveText(['Status', 'Price paid', 'Acquisition date', 'Acquired from'])
  await expect(written.locator('dd').nth(0)).toHaveText('Owned')
  await expect(written.locator('dd').nth(1)).toHaveText('€45')
  await expect(written.locator('dd').nth(3)).toHaveText('SPIEL Essen 2026 · booth 3-A101')
  await expect(sheet.getByText("Price, date and where from go into the game's private info on BGG, which only you see.")).toBeVisible()
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toHaveCount(0)
  expect(saves).toEqual([])
})

test('Mark as owned when signed out signs in first, then saves; toast and the Owned badge', async ({ page }) => {
  const saves: unknown[] = []
  await setUp(page, { signedIn: false, saves })
  await buyInList(page, 'Copper Valley')
  const sheet = ownSheet(page)
  await expect(sheet.getByText("You'll sign in to BoardGameGeek first (once on this device).")).toBeVisible()
  await sheet.getByRole('button', { name: 'Mark as owned' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in to BoardGameGeek' })
  await signIn.getByLabel('Password').fill('secret')
  await signIn.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek: Copper Valley owned, price paid added' })).toBeVisible()
  expect(saves).toEqual([
    {
      status: { own: true },
      privateInfo: { pricePaid: { amount: 45, currency: 'EUR' }, acquisitionDate: today(), acquiredFrom: 'SPIEL Essen 2026 · booth 3-A101' },
    },
  ])
  await expect(row(page, 'Copper Valley').getByLabel('On BoardGameGeek: Owned')).toBeVisible()
})

test('an owned game with a price asks to add it; a conflict asks to replace with Keep / Replace', async ({ page }) => {
  const saves: unknown[] = []
  await setUp(page, { signedIn: true, saves, priceConflict: { amount: 39.99, currency: 'EUR' } })
  await buyInList(page, 'Harbour Lights')
  const sheet = page.getByRole('dialog', { name: 'Add the price paid on BoardGameGeek?' })
  await expect(sheet.getByText('Harbour Lights is already owned on BoardGameGeek.')).toBeVisible()
  await expect(sheet.locator('dt')).toHaveText(['Price paid', 'Acquisition date'])
  await sheet.getByRole('button', { name: 'Add price' }).click()

  const replace = page.getByRole('dialog', { name: 'Replace the price paid on BoardGameGeek?' })
  await expect(replace.locator('.old')).toHaveText('€39.99')
  await expect(replace.getByRole('button', { name: 'Keep €39.99' })).toBeVisible()
  await expectAccessible(page)
  await replace.getByRole('button', { name: 'Replace' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek: Harbour Lights owned, price paid added' })).toBeVisible()
  const info = { pricePaid: { amount: 45, currency: 'EUR' }, acquisitionDate: today() }
  expect(saves).toEqual([{ privateInfo: info }, { privateInfo: info, replacePrice: true }])
})

test('Keep sends replacePrice false and says no price was added', async ({ page }) => {
  const saves: unknown[] = []
  await setUp(page, { signedIn: true, saves, priceConflict: { amount: 39.99, currency: 'EUR' } })
  await buyInList(page, 'Harbour Lights')
  await page.getByRole('dialog', { name: 'Add the price paid on BoardGameGeek?' }).getByRole('button', { name: 'Add price' }).click()
  await page.getByRole('dialog', { name: 'Replace the price paid on BoardGameGeek?' }).getByRole('button', { name: 'Keep €39.99' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Saved on BoardGameGeek: Harbour Lights owned$/ })).toBeVisible()
  expect(saves.at(-1)).toMatchObject({ replacePrice: false })
})

test('Bought it in a Buy › Search game sheet asks the price, then the same question, and creates no shopping list', async ({ page }) => {
  const saves: unknown[] = []
  const pushed: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/sync') && request.method() === 'POST') pushed.push(request.postData() ?? '')
  })
  await setUp(page, { signedIn: true, saves })
  await fakeSearch(page, { results: { copper: [{ bggId: 7302, name: 'Copper Valley', year: 2023, kind: 'boardgame' }] } })
  await page.goto('/#/buy')
  await page.getByRole('searchbox', { name: 'Find a game' }).fill('copper')
  await page.getByRole('button', { name: 'Copper Valley, 2023', exact: true }).click()
  await page.getByRole('dialog', { name: 'Copper Valley' }).getByRole('button', { name: '✅ Bought it' }).click()
  const buy = page.getByRole('dialog', { name: 'Bought Copper Valley?' })
  await buy.getByLabel('What did you pay?').fill('30')
  await buy.getByRole('button', { name: 'Got it' }).click()
  const sheet = ownSheet(page)
  await expect(sheet.locator('dt')).toHaveText(['Status', 'Price paid', 'Acquisition date'])
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Mark as owned' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on BoardGameGeek: Copper Valley owned, price paid added' })).toBeVisible()
  expect(saves).toEqual([{ status: { own: true }, privateInfo: { pricePaid: { amount: 30, currency: 'EUR' }, acquisitionDate: today() } }])
  expect(pushed.filter(body => body.includes('"bggId":7302'))).toEqual([])
})
