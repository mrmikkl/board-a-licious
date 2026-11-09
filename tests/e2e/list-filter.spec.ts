import { type Page, expect, test } from '@playwright/test'

import {
  type FakeCollectionItem,
  expectAccessible,
  fakeBggCollection,
  keepBggSettingsLocal,
  mainButton,
  setBggUsername,
  setLengthLimitsOnDevice,
} from './helpers.ts'

/** F009 US1, US2, US4 (spec.md, design.md, contracts/ui.md): the Filter of the BGG lists. */

type Details = { name: string; len: number | null; mech: string[]; des: string[]; r: number | null; gr: number | null; best?: number[]; rec?: number[]; max?: number }

/** BGG's poll per count 1…max: best counts mostly Best, rec counts mostly Recommended, others Not recommended. */
function poll({ best = [], rec = [], max = 6 }: Details) {
  if (best.length + rec.length === 0) return null
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1
    const [b, r, not] = best.includes(n) ? [10, 3, 1] : rec.includes(n) ? [2, 10, 1] : [0, 2, 10]
    return { players: String(n), best: b, recommended: r, notRecommended: not }
  })
}

const GAMES: Record<number, Details> = {
  9001: { name: 'Cascadia', len: 45, mech: ['Tile Placement', 'Drafting'], des: ['Randy Flynn'], r: 7.9, gr: 7.7, best: [2, 3], rec: [1, 4] },
  9002: { name: 'Pandemic', len: 45, mech: ['Cooperative Game', 'Hand Management'], des: ['Matt Leacock'], r: 7.5, gr: 7.4, best: [4], rec: [2, 3] },
  9003: { name: 'Spirit Island', len: 120, mech: ['Cooperative Game', 'Area Majority', 'Variable Player Powers'], des: ['R. Eric Reuss'], r: 8.3, gr: 8.1, best: [2], rec: [1, 3] },
  9004: { name: 'Brass: Birmingham', len: 120, mech: ['Hand Management', 'Network Building', 'Loans'], des: ['Gavan Brown', 'Matt Tolman', 'Martin Wallace'], r: 8.6, gr: 8.4, best: [3, 4], rec: [2] },
  9005: { name: 'Hanabi', len: 25, mech: ['Cooperative Game', 'Hand Management', 'Memory'], des: ['Antoine Bauza'], r: 7.0, gr: 6.9, best: [4], rec: [2, 3, 5] },
  9006: { name: 'Mycelia', len: 60, mech: ['Deck Building', 'Cooperative Game'], des: ['Ralph Bienert', 'Daniel Greiner'], r: 7.2, gr: 6.6, best: [2], rec: [1, 3] },
  9007: { name: 'Lacuna', len: null, mech: ['Area Majority'], des: ['Mathew Dunstan'], r: null, gr: null },
  9008: { name: 'Twilight Imperium', len: 480, mech: ['Trading', 'Variable Player Powers'], des: ['Dane Beltrami'], r: 8.6, gr: 8.2, best: [6], rec: [4, 5] },
  9009: { name: 'Wavelength', len: 30, mech: ['Party Game', 'Team-Based Game'], des: ['Alex Hague', 'Justin Vickers'], r: 7.4, gr: 7.1, best: [8, 9, 10], rec: [4, 5, 6, 7], max: 10 },
}
const IDS = Object.keys(GAMES).map(Number)

const answer = (id: number) => {
  const g = GAMES[id] ?? { name: `Game ${id}`, len: 30, mech: ['Dice Rolling'], des: ['Someone'], r: 6.5, gr: 6, rec: [2] }
  return {
    bggId: id, name: g.name, year: 2020, thumbnailUrl: null, description: `About ${g.name}.`, kind: 'boardgame',
    minPlayers: 1, maxPlayers: g.max ?? 6, designers: g.des, mechanisms: g.mech, publisher: null, rating: g.r, geekRating: g.gr,
    bestWith: null, recommendedWith: null, playerPoll: poll(g), playerPollVoters: g.best || g.rec ? 14 : null, playingTime: g.len,
  }
}

/**
 * `/api/bgg/games` with the details above (other ids: a plain 30-minute game). `asked` collects the
 * asked ids per call; while `hold` is set a call waits for it; `offline` makes calls fail as without a
 * connection.
 */
function fakeDetails(page: Page) {
  const state = { asked: [] as number[][], hold: undefined as Promise<void> | undefined, offline: false }
  void page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    state.asked.push(ids)
    if (state.hold) await state.hold
    if (state.offline) return route.abort('internetdisconnected')
    await route.fulfill({ json: { games: ids.map(answer) } })
  })
  return state
}
function gate() {
  let open!: () => void
  const held = new Promise<void>(resolve => (open = resolve))
  return { held, open: () => open() }
}

/** A one-page preview of its own (the dev database is shared between test runs). */
async function fakePreview(page: Page, ids: number[]) {
  const listId = 800000 + Math.floor(Math.random() * 99999)
  await page.route(`**/api/bgg/lists/preview/${listId}?**`, route =>
    route.fulfill({
      json: {
        kind: 'preview', id: listId, title: 'Filter preview', isEssen: false, page: 1, pageCount: 1,
        entries: ids.map((bggId, i) => ({ position: i + 1, bggId, name: GAMES[bggId]?.name ?? `Game ${bggId}`, thumbnailUrl: null })),
      },
    }),
  )
  await page.goto(`/#/lists/preview/${listId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Filter preview' })).toBeVisible()
  return listId
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Filter' })
const countLine = (page: Page) => page.getByRole('main').getByRole('status').filter({ hasText: / of \d+ games$/ })
const row = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}`) })

test('a preview: Filter is the main button; the sheet reads details, filters at once and stays set', async ({ page }) => {
  const bgg = fakeDetails(page)
  const reading = gate()
  bgg.hold = reading.held
  await fakePreview(page, IDS)

  // no details are read before a filter needs them
  expect(bgg.asked).toEqual([])
  const filter = mainButton(page)
  await expect(filter).toHaveAccessibleName('Filter')
  await expect(filter.locator('.main-label')).toHaveText('Filter')
  await expect(page.getByRole('navigation', { name: 'Actions' }).locator('.act')).toHaveCount(0)
  await filter.click()

  const s = sheet(page)
  await expect(s.getByRole('status').filter({ hasText: 'Reading game details from BoardGameGeek… 0 of 9' })).toBeVisible()
  bgg.hold = undefined
  reading.open()
  await expect(s.getByText(/Reading game details/)).toHaveCount(0)
  expect(bgg.asked).toEqual([IDS])

  // Length: the four ranges with counts; one game has no length
  const length = s.getByRole('group', { name: 'Length' })
  await expect(length.getByRole('button')).toHaveText(['Short · 0–30 min2', 'Middle · 31–60 min3', 'Long · 61–120 min2', 'Very long · 121+ min1'])
  await expect(s.getByText('1 game has no length on BoardGameGeek.')).toBeVisible()

  // Mechanisms: counts, the 8 most common first, Show all and the find field
  const mechanisms = s.getByRole('group', { name: 'Mechanisms' })
  await expect(mechanisms.getByRole('checkbox')).toHaveCount(8)
  await expect(mechanisms.locator('.filter-row').first()).toHaveText('Cooperative Game4')
  // Designers have 13 too: the Mechanisms section's own button
  await s.locator('section').filter({ has: page.getByRole('heading', { name: 'Mechanisms' }) }).getByRole('button', { name: 'Show all (13)' }).click()
  await expect(mechanisms.getByRole('checkbox')).toHaveCount(13)
  await s.getByRole('searchbox', { name: 'Find in Mechanisms' }).fill('coop')
  await expect(mechanisms.getByRole('checkbox')).toHaveCount(1)
  await mechanisms.getByRole('checkbox', { name: 'Cooperative Game' }).check()
  await s.getByRole('searchbox', { name: 'Find in Mechanisms' }).fill('')

  // the list behind narrows at once
  await expect(countLine(page)).toHaveText('4 of 9 games')
  await expect(s.getByRole('button', { name: 'Done · 4 games' })).toBeVisible()
  await length.getByRole('button', { name: /^Middle/ }).click()
  await expect(length.getByRole('button', { name: /^Middle/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(countLine(page)).toHaveText('2 of 9 games')
  await length.getByRole('button', { name: /^Short/ }).click()
  await expect(countLine(page)).toHaveText('3 of 9 games')

  // Designers: found through the find field (beyond the first 8), a ticked designer narrows further
  await s.getByRole('searchbox', { name: 'Find in Designers' }).fill('leac')
  await s.getByRole('group', { name: 'Designers' }).getByRole('checkbox', { name: 'Matt Leacock' }).check()
  await expect(countLine(page)).toHaveText('1 of 9 games')
  await expectAccessible(page)

  // Clear filters at the top resets everything; both are disabled at the default
  const clears = s.getByRole('button', { name: 'Clear filters' })
  await expect(clears).toHaveCount(2)
  await clears.first().click()
  await expect(countLine(page)).toHaveCount(0)
  await expect(clears.first()).toBeDisabled()
  await expect(clears.last()).toBeDisabled()

  // Players: 1–6 by a tap, Best and Recommended both ticked; a typed 10 is used as typed
  const players = s.getByRole('group', { name: 'Number of players' })
  await players.getByRole('button', { name: '4', exact: true }).click()
  const kinds = s.getByRole('group', { name: 'With 4 players the game is' })
  await expect(kinds.getByRole('button', { name: /^Best/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(kinds.getByRole('button', { name: /^Recommended/ })).toHaveAttribute('aria-pressed', 'true')
  // best with 4: Pandemic, Brass, Hanabi; recommended: Cascadia, Twilight Imperium, Wavelength
  await expect(countLine(page)).toHaveText('6 of 9 games')
  await kinds.getByRole('button', { name: /^Recommended/ }).click()
  await expect(countLine(page)).toHaveText('3 of 9 games')
  // one kind always stays ticked
  await kinds.getByRole('button', { name: /^Best/ }).click()
  await expect(kinds.getByRole('button', { name: /^Best/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(kinds.getByRole('button', { name: /^Recommended/ })).toHaveAttribute('aria-pressed', 'true')
  await players.getByRole('button', { name: '4', exact: true }).click()
  await expect(countLine(page)).toHaveCount(0)
  const other = s.getByRole('textbox', { name: 'Other number of players' })
  await other.fill('10')
  await expect(other).toHaveValue('10')
  await expect(s.getByRole('group', { name: 'With 10 players the game is' })).toBeVisible()
  await expect(countLine(page)).toHaveText('1 of 9 games')
  await expect(row(page, 'Wavelength')).toBeVisible()
  await players.getByRole('button', { name: '2', exact: true }).click()
  await expect(other).toHaveValue('')

  // Done closes; the main button shows the filter is active; the name filter works on top
  await s.getByRole('button', { name: /^Done · \d+ games$/ }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(filter).toHaveAccessibleName('Filter (active)')
  await expect(filter.locator('.main-dot')).toHaveCount(1)
  await expect(countLine(page)).toHaveText('6 of 9 games')
  await page.getByLabel('Filter this list').fill('Cas')
  await expect(countLine(page)).toHaveText('1 of 9 games')
  await page.getByLabel('Filter this list').fill('')

  // the filter survives a reload; the details are not read again
  const asked = bgg.asked.length
  await page.reload()
  await expect(countLine(page)).toHaveText('6 of 9 games')
  await expect(filter).toHaveAccessibleName('Filter (active)')
  await filter.click()
  await expect(sheet(page).getByRole('group', { name: 'With 2 players the game is' })).toBeVisible()
  expect(bgg.asked.length).toBe(asked)

  // Clear filters on the screen brings back the whole list
  await sheet(page).getByRole('button', { name: /^Done/ }).click()
  await page.getByRole('main').getByRole('button', { name: 'Clear filters' }).click()
  await expect(countLine(page)).toHaveCount(0)
  await expect(filter).toHaveAccessibleName('Filter')
})

test('reading details: chunks of 40 one after the other with progress; offline leaves games out with Try again', async ({ page }) => {
  const bgg = fakeDetails(page)
  const first = gate()
  const ids = Array.from({ length: 50 }, (_, i) => 9100 + i)
  await fakePreview(page, ids)
  bgg.hold = first.held
  await mainButton(page).click()
  const s = sheet(page)
  await expect(s.getByRole('status').filter({ hasText: 'Reading game details from BoardGameGeek… 0 of 50' })).toBeVisible()
  const second = gate()
  bgg.hold = second.held
  first.open()
  await expect(s.getByRole('status').filter({ hasText: 'Reading game details from BoardGameGeek… 40 of 50' })).toBeVisible()
  expect(bgg.asked.map(a => a.length)).toEqual([40, 10])
  // offline: the rest is left out, with Try again
  bgg.offline = true
  second.open()
  bgg.hold = undefined
  await expect(s.getByText('10 games are left out: their details need a connection.')).toBeVisible()
  await expect(s.getByRole('group', { name: 'Length' }).getByRole('button', { name: /^Short/ })).toHaveText('Short · 0–30 min40')
  bgg.offline = false
  await s.getByRole('button', { name: 'Try again' }).click()
  await expect(s.getByText(/left out/)).toHaveCount(0)
  await expect(s.getByRole('group', { name: 'Length' }).getByRole('button', { name: /^Short/ })).toHaveText('Short · 0–30 min50')
  expect(bgg.asked.at(-1)).toEqual(ids.slice(40))
})

test('Length uses the limits from Config; a ticked range keeps its name with the new limits', async ({ page }) => {
  await keepBggSettingsLocal(page)
  fakeDetails(page)
  await fakePreview(page, IDS)
  await mainButton(page).click()
  const length = sheet(page).getByRole('group', { name: 'Length' })
  await length.getByRole('button', { name: /^Short/ }).click()
  // Short 0–30: Hanabi and Wavelength
  await expect(countLine(page)).toHaveText('2 of 9 games')

  await setLengthLimitsOnDevice(page, [45, 90, 150])
  await expect(countLine(page)).toHaveText('4 of 9 games')
  await mainButton(page).click()
  await expect(length.getByRole('button')).toHaveText(['Short · 0–45 min4', 'Middle · 46–90 min1', 'Long · 91–150 min2', 'Very long · 151+ min1'])
  await expect(length.getByRole('button', { name: /^Short/ })).toHaveAttribute('aria-pressed', 'true')
})

test('Rating and Geek rating: two-handle sliders; keys step 0.1, a drag near a whole number rests on it', async ({ page }) => {
  fakeDetails(page)
  await fakePreview(page, IDS)
  await mainButton(page).click()
  const s = sheet(page)
  const ratingSection = s.locator('section').filter({ has: page.getByRole('heading', { name: 'Rating', exact: true }) })
  await expect(ratingSection.locator('.f-head .val')).toHaveText('any')
  await expect(ratingSection.locator('.slider-scale span')).toHaveText(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  await expect(s.getByText('1 game has no rating on BoardGameGeek.')).toBeVisible()

  // Rating from 7.5: Cascadia, Pandemic, Spirit Island, Brass, Twilight Imperium
  const from = s.getByRole('slider', { name: 'Rating from' })
  await from.fill('7.5')
  await expect(ratingSection.locator('.f-head .val')).toHaveText('7.5 – 10.0')
  await expect(countLine(page)).toHaveText('5 of 9 games')
  // keys step 0.1 and do not snap
  await from.press('ArrowRight')
  await expect(from).toHaveValue('7.6')
  await expect(countLine(page)).toHaveText('4 of 9 games')
  await from.press('ArrowLeft')
  await expect(countLine(page)).toHaveText('5 of 9 games')
  // the handles cannot cross
  await s.getByRole('slider', { name: 'Rating to' }).fill('7')
  await expect(s.getByRole('slider', { name: 'Rating to' })).toHaveValue('7.5')
  await s.getByRole('slider', { name: 'Rating to' }).fill('10')
  await from.fill('0')
  await expect(countLine(page)).toHaveCount(0)

  // a drag of "Geek rating to" to about 6.85 rests on 7.0: Hanabi 6.9 and Mycelia 6.6 remain
  const to = s.getByRole('slider', { name: 'Geek rating to' })
  await to.scrollIntoViewIfNeeded()
  const box = (await to.boundingBox())!
  const x = (v: number) => box.x + 13 + (v / 10) * (box.width - 26)
  const y = box.y + box.height / 2
  await page.mouse.move(x(10), y)
  await page.mouse.down()
  await page.mouse.move(x(8), y, { steps: 4 })
  await page.mouse.move(x(6.85), y, { steps: 4 })
  await page.mouse.up()
  await expect(to).toHaveValue('7')
  const geekSection = s.locator('section').filter({ has: page.getByRole('heading', { name: 'Geek rating' }) })
  await expect(geekSection.locator('.f-head .val')).toHaveText('0.0 – 7.0')
  await expect(countLine(page)).toHaveText('2 of 9 games')
  await expectAccessible(page)
})

const MINE: FakeCollectionItem[] = IDS.map(bggId => ({ bggId, name: GAMES[bggId]!.name, year: 2020, status: { own: true } }))

async function withStatusLists(page: Page) {
  await keepBggSettingsLocal(page)
  const bgg = fakeDetails(page)
  await fakeBggCollection(page, { mrmikkl: MINE, anna: MINE.slice(0, 4).map(g => ({ ...g, status: { wishlist: 2 } })) })
  await page.goto('/#/config')
  await setBggUsername(page, 'mrmikkl')
  return bgg
}

test('an own status list: Filter is an action at the left, Add game the main button', async ({ page }) => {
  await withStatusLists(page)
  await page.goto('/#/lists/status/mrmikkl/own')
  await expect(page.getByRole('heading', { level: 1, name: 'Owned' })).toBeVisible()
  const bar = page.getByRole('navigation', { name: 'Actions' })
  await expect(mainButton(page)).toHaveAccessibleName('Add a game to Owned')
  const action = bar.locator('.actionbar-left').getByRole('button', { name: 'Filter' })
  await expect(action).toBeVisible()
  await action.click()
  await sheet(page).getByRole('group', { name: 'Mechanisms' }).getByRole('checkbox', { name: 'Cooperative Game' }).check()
  await expect(countLine(page)).toHaveText('4 of 9 games')
  await expectAccessible(page)
  await sheet(page).getByRole('button', { name: /^Done/ }).click()
  await expect(bar.locator('.actionbar-left').getByRole('button', { name: 'Filter (active)' })).toBeVisible()
  await expect(row(page, 'Pandemic')).toBeVisible()
  await expect(row(page, 'Cascadia')).toHaveCount(0)

  // per list: the Wishlist of a friend has its own filter, with Filter as main button
  await page.goto('/#/lists/status/anna/wishlist')
  await expect(page.getByRole('heading', { level: 1, name: 'anna: Wishlist' })).toBeVisible()
  await expect(mainButton(page)).toHaveAccessibleName('Filter')
  await expect(countLine(page)).toHaveCount(0)
  await mainButton(page).click()
  await sheet(page).getByRole('group', { name: 'Length' }).getByRole('button', { name: /^Long/ }).click()
  await expect(countLine(page)).toHaveText('2 of 4 games')
  await expectAccessible(page)
})
