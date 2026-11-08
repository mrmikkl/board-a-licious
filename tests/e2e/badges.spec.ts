import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  expectAccessible,
  fakeBggCollection,
  fakeNoGameDetails,
  keepBggSettingsLocal,
  seedCollection,
  setBggUsername,
  unique,
} from './helpers.ts'

/** F008 US2 (docs/design.md "BGG status badge", "Badge colours", "Filter and group"): statuses everywhere. */
const MINE: FakeCollectionItem[] = [
  { bggId: 7101, name: 'Harbour Lights', year: 2024, status: { own: true, wishlist: 2, wantToPlay: true } },
  { bggId: 7102, name: 'Copper Valley', year: 2023, status: { wishlist: 1 } },
  { bggId: 7104, name: 'Owl Post', year: 2022, status: { own: true } },
]
const ANNA: FakeCollectionItem[] = [{ bggId: 7103, name: 'Salt Roads', year: 2025, status: { wishlist: 1 } }]
const SHOPPING = [
  { bggId: 7101, name: 'Harbour Lights', mark: 'must_have' },
  { bggId: 7102, name: 'Copper Valley', mark: 'interested' },
  { bggId: 7103, name: 'Salt Roads', mark: 'interested' },
  { bggId: 7104, name: 'Owl Post', mark: 'unsure' },
]

const badgesOf = (page: Page) => page.getByLabel(/^On BoardGameGeek:/)
const row = (page: Page, name: string) => page.locator('.row').filter({ has: page.getByRole('button', { name: new RegExp(`^${name},`) }) })

async function withUsername(page: Page) {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE, anna_meeple: ANNA })
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
}

test('shopping list rows show at most two badges plus "+n", one name for all; the game sheet shows all', async ({ page }) => {
  await withUsername(page)
  await seedCollection(page, unique('Badges'), SHOPPING)
  const harbour = row(page, 'Harbour Lights')
  await expect(harbour.getByLabel('On BoardGameGeek: Owned, Wishlist 2, Want to play')).toBeVisible()
  await expect(harbour.locator('.bb')).toHaveText(['Owned', 'Wishlist 2', '+1'])
  await expect(row(page, 'Copper Valley').locator('.bb')).toHaveText(['Wishlist 1'])
  // a game without status has no badge and no empty space
  await expect(row(page, 'Salt Roads').locator('.bgg-badges')).toHaveCount(0)
  await expectAccessible(page)

  await page.getByRole('button', { name: /^Harbour Lights,/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Harbour Lights' })
  await expect(sheet.getByLabel('On BoardGameGeek: Owned, Wishlist 2, Want to play')).toBeVisible()
  await expect(sheet.locator('.gs-facts .bb')).toHaveText(['Owned', 'Wishlist 2', 'Want to play'])
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /^Salt Roads,/ }).click()
  await expect(page.getByRole('dialog', { name: 'Salt Roads' }).getByText('Not in your BGG collection')).toBeVisible()
})

test('list game rows and the swipe card show the badges', async ({ page }) => {
  await withUsername(page)
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('button', { name: 'Harbour Lights, 2024' })).toBeVisible()
  const harbour = page.locator('.row').filter({ hasText: 'Harbour Lights' })
  await expect(harbour.locator('.bb')).toHaveText(['Owned', 'Wishlist 2', '+1'])
  await expect(page.getByRole('button', { name: 'Harbour Lights, 2024' })).toHaveAccessibleDescription(/On BoardGameGeek: Owned, Wishlist 2, Want to play/)

  const id = await seedCollection(page, unique('Swipe badges'), [{ bggId: 7104, name: 'Owl Post' }])
  await page.goto(`/#/buy/lists/${id}/swipe/status/mrmikkl/wishlist`)
  const card = page.getByRole('group', { name: /^game:/i })
  await expect(card.getByRole('heading', { name: 'Copper Valley' })).toBeVisible()
  await expect(card.getByLabel('On BoardGameGeek: Wishlist 1')).toBeVisible()
  await expectAccessible(page)
})

test('no badges without a username, and a friend\'s list creates none', async ({ page }) => {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE, anna_meeple: ANNA })
  await seedCollection(page, unique('No badges'), SHOPPING)
  await expect(page.getByRole('button', { name: /^Harbour Lights,/ })).toBeVisible()
  await expect(badgesOf(page)).toHaveCount(0)
  await page.getByRole('button', { name: /^Harbour Lights,/ }).click()
  await expect(page.getByRole('dialog', { name: 'Harbour Lights' })).toBeVisible()
  await expect(page.getByText('Not in your BGG collection')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

  // anna's Wishlist holds Salt Roads; it is not in mine, so it stays without a badge
  await setBggUsername(page, 'mrmikkl')
  await page.goto('/#/lists/status/anna_meeple/wishlist')
  await expect(page.getByRole('button', { name: 'Salt Roads, 2025' })).toBeVisible()
  await expect(badgesOf(page)).toHaveCount(0)
})

test('Config › Badge colours: a colour per status, picked in a sheet, applied at once, reset', async ({ page }) => {
  await withUsername(page)
  const colours = page.getByRole('region', { name: 'Badge colours' })
  await expect(colours.getByRole('button', { name: /^Change the colour of / })).toHaveCount(8)
  const reset = colours.getByRole('button', { name: 'Reset colours' })
  await expect(reset).toBeDisabled()
  await expectAccessible(page)

  await colours.getByRole('button', { name: 'Change the colour of Owned' }).click()
  const sheet = page.getByRole('dialog', { name: 'Colour of “Owned”' })
  const swatches = sheet.getByRole('group', { name: 'Colour' }).getByRole('button')
  await expect(swatches).toHaveCount(10)
  for (const [i, name] of ['Cool', 'Hot', 'Mint', 'Pink', 'White', 'Violet', 'Dusk', 'Red', 'Mud', 'Grey'].entries()) await expect(swatches.nth(i)).toHaveAccessibleName(name)
  await expect(sheet.getByRole('button', { name: 'Cool' })).toHaveAttribute('aria-pressed', 'true')
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Hot' }).click()
  // applies at once, in the sheet's preview and behind it
  await expect(sheet.getByRole('button', { name: 'Hot' })).toHaveAttribute('aria-pressed', 'true')
  await expect(sheet.locator('.colour-preview .bb')).toHaveAttribute('data-colour', 'hot')
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toBeHidden()
  await expect(colours.getByRole('button', { name: 'Change the colour of Owned' }).locator('.bb')).toHaveAttribute('data-colour', 'hot')

  // remembered on the device, and used by the badges
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.locator('.row').filter({ hasText: 'Owl Post' }).locator('.bb')).toHaveAttribute('data-colour', 'hot')
  await page.goto('/#/config')
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(reset).toBeDisabled()
  await expect(colours.getByRole('button', { name: 'Change the colour of Owned' }).locator('.bb')).toHaveAttribute('data-colour', 'cool')
})

test('Filter › BGG status narrows a shopping list', async ({ page }) => {
  await withUsername(page)
  await seedCollection(page, unique('Filter badges'), SHOPPING)
  const filter = page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: /^Filter/ })
  await filter.click()
  const sheet = page.getByRole('dialog', { name: 'Filter and group' })
  const segment = sheet.getByRole('group', { name: 'BGG status' })
  await expect(segment.getByRole('button')).toHaveText(['All', 'Owned', 'Not owned', 'Wishlist'])
  await expect(segment.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await expectAccessible(page)

  const names = page.locator('main .row .row-name')
  await segment.getByRole('button', { name: 'Owned', exact: true }).click()
  await expect(names).toHaveText([/Harbour Lights/, /Owl Post/])
  await segment.getByRole('button', { name: 'Not owned' }).click()
  await expect(names).toHaveText([/Copper Valley/, /Salt Roads/])
  await segment.getByRole('button', { name: 'Wishlist' }).click()
  await expect(names).toHaveText([/Harbour Lights/, /Copper Valley/])
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: 'Filter (active)' })).toBeVisible()
  await filter.click()
  await sheet.getByRole('button', { name: 'Clear filters' }).click()
  await expect(names).toHaveCount(4)
})
