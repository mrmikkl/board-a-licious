import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  createCollection,
  expectAccessible,
  fakeBggCollection,
  fakeNoGameDetails,
  goTo,
  keepBggSettingsLocal,
  loadList,
  mainButton,
  openTab,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F008 US1 (spec.md, docs/design.md "Status list card", "Status list"): the person's BGG statuses as lists. */
const MINE: FakeCollectionItem[] = [
  { bggId: 295947, name: 'Cascadia', year: 2021, status: { own: true, wantToPlay: true } },
  { bggId: 342942, name: 'Ark Nova', year: 2021, status: { own: true } },
  { bggId: 316554, name: 'Dune: Imperium', year: 2020, status: { wishlist: 1 } },
  { bggId: 300531, name: 'Arcs', year: 2024, status: { wishlist: 3 } },
  { bggId: 359871, name: 'Faraway', year: 2023, status: { wishlist: 1 } },
]
const ANNA: FakeCollectionItem[] = [
  { bggId: 300531, name: 'Arcs', year: 2024, status: { wishlist: 2 } },
  { bggId: 224517, name: 'Brass: Birmingham', year: 2018, status: { wishlist: 1, forTrade: true } },
]

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function signedUp(page: Page, collections: Record<string, FakeCollectionItem[]> = { mrmikkl: MINE }, options: Parameters<typeof fakeBggCollection>[2] = {}) {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, collections, options)
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
}

test('without a username, Status lists invites to add it in Config', async ({ page }) => {
  await keepBggSettingsLocal(page)
  await page.goto('/#/lists/status')
  await expect(page.getByRole('heading', { name: 'What you own, wish for and want to play' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Add username in Config' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Config' })).toBeVisible()
  await expect(page.getByLabel('Your BGG username')).toBeVisible()
})

test('Config saves the username; Status lists shows one card per status with games', async ({ page }) => {
  await signedUp(page)
  await expectAccessible(page)
  // the name stays after a reload
  await page.reload()
  await expect(page.getByLabel('Your BGG username')).toHaveValue('mrmikkl')

  await goTo(page, 'Lists', 'Status lists')
  const mine = page.getByRole('heading', { name: /^Mine/ })
  await expect(mine).toContainText('mrmikkl on BoardGameGeek')
  await expect(mine).toContainText(/loaded just now/)
  await expect(card(page, 'Owned, 2 games')).toBeVisible()
  await expect(card(page, 'Wishlist, 3 games')).toBeVisible()
  await expect(card(page, 'Want to play, 1 game')).toBeVisible()
  // statuses without games are left out
  await expect(page.getByRole('button', { name: /^For trade/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Previously owned/ })).toHaveCount(0)
  await expect(page.getByText('by priority, 1 Must have first')).toBeVisible()
  await expectAccessible(page)
})

test('a status list shows list game rows; the Wishlist is grouped by priority', async ({ page }) => {
  await signedUp(page)
  await page.goto('/#/lists/status')
  await card(page, 'Owned, 2 games').click()
  await expect(page).toHaveURL(/#\/lists\/status\/mrmikkl\/own$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Owned' })).toBeVisible()
  await expect(page.getByText(/mrmikkl on BoardGameGeek · loaded/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read again from BGG' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Cascadia to shopping lists' })).toBeVisible()
  await expectAccessible(page)

  // a row opens the game sheet
  await page.getByRole('button', { name: 'Cascadia, 2021' }).click()
  await expect(page.getByRole('dialog', { name: 'Cascadia' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Back' }).click()
  await card(page, 'Wishlist, 3 games').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wishlist' })).toBeVisible()
  const groups = page.locator('.status-group h2')
  await expect(groups).toHaveText([/^1 Must have\s*2$/, /^3 Like to have\s*1$/])
  await expect(page.locator('.status-group').first().locator('.row-name')).toHaveText(['Dune: Imperium', 'Faraway'])
  await expectAccessible(page)
})

test('while BGG prepares the collection the list says so and loads by itself', async ({ page }) => {
  test.setTimeout(60_000)
  await signedUp(page, { mrmikkl: MINE }, { preparingFor: 12_000 })
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByText('BoardGameGeek is preparing your collection… it loads by itself when ready')).toBeVisible()
  await expectAccessible(page)
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('BoardGameGeek is preparing your collection')).toHaveCount(0)
})

test('an unknown username says so and links to Config', async ({ page }) => {
  await signedUp(page, {})
  await page.goto('/#/lists/status')
  await expect(page.getByText('No BoardGameGeek user called “mrmikkl”')).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Change it in Config' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Config' })).toBeVisible()
})

test('Read again from BGG asks BGG afresh', async ({ page }) => {
  const asked: string[] = []
  await signedUp(page, { mrmikkl: MINE }, { asked })
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible()
  expect(asked.some(url => url.includes('fresh=1'))).toBe(false)
  await page.getByRole('button', { name: 'Read again from BGG' }).click()
  await expect.poll(() => asked.filter(url => url.includes('fresh=1')).length).toBe(1)
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible()
})

test("a friend's collection link via the plus adds their read-only cards", async ({ page }) => {
  await signedUp(page, { mrmikkl: MINE, anna_meeple: ANNA })
  await loadList(page, 'https://boardgamegeek.com/collection/user/Anna_Meeple?wishlist=1&subtype=boardgame&ff=1')
  await expect(page).toHaveURL(/#\/lists\/status\/anna_meeple\/wishlist$/)
  await expect(page.getByRole('heading', { level: 1, name: 'anna_meeple: Wishlist' })).toBeVisible()
  await expect(page.getByText(/anna_meeple on BoardGameGeek · read-only/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Brass: Birmingham, 2018' })).toBeVisible()

  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: /^anna_meeple/ })).toContainText('loaded by link · read-only')
  await expect(card(page, 'Wishlist, 2 games').last()).toBeVisible()
  await expect(card(page, 'For trade, 1 game')).toBeVisible()
  // mine stay first
  await expect(page.locator('.person').first()).toContainText('Mine')
  await expectAccessible(page)
})

test('the own collection link is not followed as a friend', async ({ page }) => {
  await signedUp(page)
  await loadList(page, 'https://boardgamegeek.com/collection/user/mrmikkl?own=1')
  await expect(page).toHaveURL(/#\/lists\/status\/mrmikkl\/own$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Owned' })).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByText('loaded by link · read-only')).toHaveCount(0)
})

test("BG-Tinder's list choice offers the status lists and swipes one", async ({ page }) => {
  await signedUp(page)
  await page.goto('/#/lists/status')
  await expect(card(page, 'Owned, 2 games')).toBeVisible()
  const name = unique('Wishes')
  await createCollection(page, name)
  await mainButton(page).click()
  const picker = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  await picker.getByRole('button', { name: /^Wishlist/ }).click()
  await picker.getByRole('button', { name: 'Select' }).click()
  await expect(page).toHaveURL(/\/swipe\/status\/mrmikkl\/wishlist$/)
  const top = page.getByRole('group', { name: /^game:/i })
  await expect(top.getByRole('heading', { name: 'Dune: Imperium' })).toBeVisible()
  await page.getByRole('button', { name: 'Add to shopping list' }).click()
  await expect(top.getByRole('heading', { name: 'Faraway' })).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /^Dune: Imperium/ })).toBeVisible()
})

test('offline, a status list shows the stored copy with its time', async ({ page, context }) => {
  const loadedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  await signedUp(page, { mrmikkl: MINE }, { loadedAt })
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible()
  await expect(page.getByText(/loaded 2 h ago/)).toBeVisible()
  await page.goto('/#/lists/status')
  await expect(card(page, 'Owned, 2 games')).toBeVisible()

  await context.setOffline(true)
  await card(page, 'Owned, 2 games').click()
  await expect(page.getByRole('button', { name: 'Ark Nova, 2021' })).toBeVisible()
  await expect(page.getByText(/loaded 2 h ago · offline/)).toBeVisible()
  await context.setOffline(false)
})

test('the Lists tab Status lists is opened from the menu', async ({ page }) => {
  await signedUp(page)
  await goTo(page, 'Lists')
  await openTab(page, 'Status lists')
  await expect(card(page, 'Owned, 2 games')).toBeVisible()
})
