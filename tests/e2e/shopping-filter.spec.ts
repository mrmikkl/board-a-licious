import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBggCollection, fakeNoGameDetails, keepBggSettingsLocal, seedCollection, setBggUsername, unique } from './helpers.ts'

/** F009 US5 (spec.md FR-013, docs/design.md 3.3.0 "Filter and group"): the game filter in shopping lists. */

type Details = { name: string; mark: string; len: number; mech: string[]; des: string[]; r: number; gr: number; bought?: boolean }

const GAMES: Record<number, Details> = {
  9301: { name: 'Cobalt Rescue', mark: 'must_have', len: 45, mech: ['Cooperative Game', 'Hand Management'], des: ['Ada Lind'], r: 7.6, gr: 7.2 },
  9302: { name: 'Amber Fleet', mark: 'interested', len: 30, mech: ['Cooperative Game', 'Dice Rolling'], des: ['Bo Krane'], r: 6.8, gr: 6.1 },
  9303: { name: 'Slate Empire', mark: 'must_have', len: 150, mech: ['Worker Placement'], des: ['Ada Lind'], r: 8.2, gr: 7.9 },
  9304: { name: 'Opal Bazaar', mark: 'unsure', len: 60, mech: ['Trading'], des: ['Cy Moss'], r: 7.1, gr: 6.6, bought: true },
}
const IDS = Object.keys(GAMES).map(Number)

const answer = (id: number) => {
  const g = GAMES[id]!
  return {
    bggId: id, name: g.name, year: 2025, thumbnailUrl: null, description: `About ${g.name}.`, kind: 'boardgame',
    minPlayers: 1, maxPlayers: 4, designers: g.des, mechanisms: g.mech, publisher: null, rating: g.r, geekRating: g.gr,
    bestWith: null, recommendedWith: null, playerPoll: null, playerPollVoters: null, playingTime: g.len,
  }
}

/**
 * The shopping list of this test, then `/api/bgg/games` with the full details (seedCollection answers
 * names only, so the filter still lacks them); while `hold` is set a call waits for it.
 */
async function seed(page: Page) {
  await seedCollection(page, unique('Shop filter'), IDS.map(bggId => ({ bggId, name: GAMES[bggId]!.name, mark: GAMES[bggId]!.mark, bought: GAMES[bggId]!.bought })))
  const state = { hold: undefined as Promise<void> | undefined }
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    if (!ids.some(id => GAMES[id])) return route.fallback()
    if (state.hold) await state.hold
    await route.fulfill({ json: { games: ids.filter(id => GAMES[id]).map(answer) } })
  })
  return state
}

const filterAction = (page: Page) => page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: /^Filter/ })
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Filter and group' })
const row = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`^${name},`) })

test('"Filter and group" reads missing details, then shows "About the game" with the same sections', async ({ page }) => {
  const bgg = await seed(page)
  let open!: () => void
  bgg.hold = new Promise<void>(resolve => (open = resolve))
  await filterAction(page).click()
  const s = sheet(page)
  await expect(s.getByRole('status').filter({ hasText: 'Reading game details from BoardGameGeek… 0 of 4' })).toBeVisible()
  open()
  await expect(s.getByText(/Reading game details/)).toHaveCount(0)

  // the shopping list's own sections first, then the heading and the list filter's sections
  for (const name of ['Bought', 'Price', 'Categories']) await expect(s.getByRole('group', { name, exact: true })).toBeVisible()
  await expect(s.getByRole('heading', { name: 'About the game' })).toBeVisible()
  await expect(s.getByRole('group', { name: 'Length' })).toBeVisible()
  await expect(s.getByRole('group', { name: 'Number of players' })).toBeVisible()
  await expect(s.getByRole('slider', { name: 'Rating from', exact: true })).toBeVisible()
  await expect(s.getByRole('slider', { name: 'Geek rating to' })).toBeVisible()
  await expect(s.getByRole('group', { name: 'Mechanisms' }).getByRole('checkbox', { name: 'Cooperative Game' })).toBeVisible()
  await expect(s.getByRole('group', { name: 'Designers' }).getByRole('checkbox', { name: 'Ada Lind' })).toBeVisible()
  // Clear filters twice (top and bottom), both disabled at the default
  await expect(s.getByRole('button', { name: 'Clear filters' })).toHaveCount(2)
  for (const clear of await s.getByRole('button', { name: 'Clear filters' }).all()) await expect(clear).toBeDisabled()
  await expectAccessible(page)
})

test('a category and a mechanism must both match; the Filter action shows it is active', async ({ page }) => {
  await seed(page)
  await filterAction(page).click()
  const s = sheet(page)
  const coop = s.getByRole('group', { name: 'Mechanisms' }).getByRole('checkbox', { name: 'Cooperative Game' })
  await coop.check()
  await s.getByRole('button', { name: 'Done' }).click()
  await expect(row(page, 'Cobalt Rescue')).toBeVisible()
  await expect(row(page, 'Amber Fleet')).toBeVisible()
  await expect(row(page, 'Slate Empire')).toHaveCount(0)
  await expect(filterAction(page)).toHaveAccessibleName('Filter (active)')

  // only Must Have, together with the mechanism
  await filterAction(page).click()
  await s.getByRole('button', { name: 'Select none' }).click()
  await s.getByRole('group', { name: 'Categories' }).getByRole('checkbox', { name: /Must Have/ }).check()
  await s.getByRole('button', { name: 'Done' }).click()
  await expect(row(page, 'Cobalt Rescue')).toBeVisible()
  await expect(row(page, 'Amber Fleet')).toHaveCount(0)
  await expect(row(page, 'Slate Empire')).toHaveCount(0)

  // kept on the device: after a reload the filter still applies
  await page.reload()
  await expect(row(page, 'Cobalt Rescue')).toBeVisible()
  await expect(row(page, 'Slate Empire')).toHaveCount(0)
  await expect(filterAction(page)).toHaveAccessibleName('Filter (active)')
})

test('Clear filters at the top resets everything: Bought, Price, BGG status, Categories and the game filter', async ({ page }) => {
  // a BGG username of this device only, so the BGG status segment shows
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { shopfilter: [{ bggId: 9301, name: 'Cobalt Rescue', status: { own: true } }] })
  await setBggUsername(page, 'shopfilter')
  await seed(page)
  await filterAction(page).click()
  const s = sheet(page)
  await s.getByRole('group', { name: 'BGG status' }).getByRole('button', { name: 'Not owned' }).click()
  await s.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'Not bought' }).click()
  await s.getByRole('group', { name: 'Price' }).getByRole('button', { name: '≤ €30' }).click()
  await s.getByRole('group', { name: 'Categories' }).getByRole('checkbox', { name: /Interested/ }).uncheck()
  await s.getByRole('group', { name: 'Length' }).getByRole('button', { name: /^Long/ }).click()
  await s.getByRole('group', { name: 'Designers' }).getByRole('checkbox', { name: 'Ada Lind' }).check()
  await expect(filterAction(page)).toHaveAccessibleName('Filter (active)')

  await s.locator('.sheet-clear-top').click()
  await expect(page.getByRole('status').filter({ hasText: 'Filters cleared' })).toBeVisible()
  await expect(s.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await expect(s.getByRole('group', { name: 'BGG status' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await expect(s.getByRole('group', { name: 'Price' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await expect(s.getByRole('group', { name: 'Categories' }).getByRole('checkbox', { name: /Interested/ })).toBeChecked()
  await expect(s.getByRole('group', { name: 'Length' }).getByRole('button', { name: /^Long/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(s.getByRole('group', { name: 'Designers' }).getByRole('checkbox', { name: 'Ada Lind' })).not.toBeChecked()
  for (const clear of await s.getByRole('button', { name: 'Clear filters' }).all()) await expect(clear).toBeDisabled()
  await s.getByRole('button', { name: 'Done' }).click()
  await expect(filterAction(page)).toHaveAccessibleName('Filter')
  for (const id of IDS) await expect(row(page, GAMES[id]!.name)).toBeVisible()
})
