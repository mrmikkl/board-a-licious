import { readFileSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { type Page, expect } from '@playwright/test'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/bgg/${name}`, import.meta.url), 'utf8')

/** F005: BGG's average and Bayes average of Cascadia, from the recorded `api/dynamicinfo` answer. */
const stats = JSON.parse(fixture('dynamicinfo-295947.json')).item.stats as { average: string; baverage: string }
export const RATINGS_295947 = { rating: Number(stats.average), geekRating: Number(stats.baverage) }

/** No end-to-end test calls the live BGG site: BGG-backed API routes answer from fixtures. */
export async function fakeBgg(page: Page) {
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const item = JSON.parse(fixture('geekitems-295947.json')).item
    const games = ids.includes(295947)
      ? [{ bggId: 295947, name: item.name, year: Number(item.yearpublished), thumbnailUrl: item.images.square200, description: item.short_description, kind: 'boardgame', ...RATINGS_295947 }]
      : []
    await route.fulfill({ json: { games } })
  })
}

/** A name nobody else's test run uses, as the dev server's database is shared between runs. */
export const unique = (name: string) => `${name} ${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`

/** Waits for sheets, menus and fades to finish (endless loops excepted), so checks see the final state. */
export async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.effect?.getTiming().iterations !== Infinity)
        .map(a => a.finished.catch(() => undefined)),
    ),
  )
}

export async function expectAccessible(page: Page) {
  await settled(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
}

/** F008 places (contracts/ui.md): Buy, Lists and Config in the app bar's menu; Buy and Lists have tabs. */
export type Place = 'Buy' | 'Lists' | 'Config'
export type Tab = 'Search' | 'Shopping lists' | 'Status lists' | 'Previews' | 'Geeklists'

export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible()
}

/** Opens a place from the menu and, when given, one of its tabs. */
export async function goTo(page: Page, place: Place, tab?: Tab) {
  await openMenu(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: place, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: place, exact: true })).toBeVisible()
  if (tab) await openTab(page, tab)
}

/** A tab of the place on screen; waits until it is selected. */
export async function openTab(page: Page, tab: Tab) {
  const button = page.getByRole('tab', { name: tab, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-selected', 'true')
}

/** F008: in the open game sheet, unfold the Category section and choose a category (it folds again). */
export async function chooseCategory(page: Page, category: RegExp) {
  const sheet = page.getByRole('dialog')
  const section = sheet.getByRole('button', { name: /^Category/ })
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click()
  await sheet.locator('.cat-list').getByRole('button', { name: category }).click()
  await expect(section).toHaveAttribute('aria-expanded', 'false')
}

/** The big hexagon in the action bar; its accessible name says what it does on the screen. */
export const mainButton = (page: Page) => page.getByRole('navigation', { name: 'Actions' }).locator('.main-btn')

/** Buy › Shopping lists → main ＋ → New shopping list sheet → Create shopping list; ends in the new list. */
export async function createCollection(page: Page, name: string) {
  if (page.url() === 'about:blank') await page.goto('/#/buy/lists')
  await goTo(page, 'Buy', 'Shopping lists')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'New shopping list' })
  await sheet.getByLabel('Name').fill(name)
  await sheet.getByRole('button', { name: 'Create shopping list' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** Lists → main ＋ → Load a BGG list sheet → Load list; ends in the list. */
export async function loadList(page: Page, link: string) {
  if (page.url() === 'about:blank') await page.goto('/#/lists')
  await goTo(page, 'Lists')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'Load a BGG list' })
  await sheet.getByLabel(/link/i).fill(link)
  await sheet.getByRole('button', { name: 'Load list' }).click()
}

/** F004: `/api/bgg/images` from the recorded gallery of Cascadia (main image first); other games have none. */
export async function fakeGallery(page: Page) {
  const recorded = JSON.parse(fixture('images-295947.json')) as {
    images: { imageid: string; imageurl_lg: string; imageurl: string; caption: string | null }[]
    pagination: { total: number }
  }
  const images = recorded.images.map(i => ({ id: Number(i.imageid), large: i.imageurl_lg, small: i.imageurl, caption: i.caption || null }))
  const ordered = [...images.filter(i => i.id === 5100691), ...images.filter(i => i.id !== 5100691)]
  await page.route('**/api/bgg/images?**', async route => {
    const id = Number(new URL(route.request().url()).searchParams.get('id'))
    await route.fulfill({ json: id === 295947 ? { bggId: id, total: recorded.pagination.total, images: ordered } : { bggId: id, total: 0, images: [] } })
  })
}

/** A game of a seeded collection (F005): its category, booth, listed price and bought state. */
export type SeedGame = {
  bggId: number
  name: string
  mark?: string
  booth?: string | null
  priceCents?: number | null
  publisher?: string | null
  factsSource?: 'preview' | 'manual' | null
  bought?: boolean
  paidCents?: number | null
  rating?: number | null
  geekRating?: number | null
}

/**
 * F005: a collection with games in given categories, pushed straight to `/api/sync` (faster than
 * adding each game by hand); `/api/bgg/games` answers their names. Ends in the collection.
 */
export async function seedCollection(page: Page, name: string, games: SeedGame[]) {
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const entries = games.map(g => ({
    collectionId: id,
    bggId: g.bggId,
    mark: g.mark ?? 'new',
    bought: g.bought ?? false,
    paidCents: g.bought ? (g.paidCents ?? null) : null,
    paidCurrency: g.bought && g.paidCents != null ? 'EUR' : null,
    facts: g.booth != null || g.priceCents != null || g.publisher != null
      ? { booth: g.booth ?? null, priceCents: g.priceCents ?? null, currency: g.priceCents != null ? 'EUR' : null, publisher: g.publisher ?? null, edition: null }
      : null,
    factsSource: g.factsSource ?? (g.booth != null || g.priceCents != null ? 'preview' : null),
    detailsPending: false,
    updatedAt: now,
    deleted: false,
  }))
  const seeded = new Map(games.map(g => [g.bggId, g]))
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    if (!ids.some(i => seeded.has(i))) return route.fallback()
    const games = ids.flatMap(i => {
      const g = seeded.get(i)
      return g ? [{ bggId: i, name: g.name, year: 2025, thumbnailUrl: null, description: `About ${g.name}.`, kind: 'boardgame', rating: g.rating ?? null, geekRating: g.geekRating ?? null }] : []
    })
    await route.fulfill({ json: { games } })
  })
  if (page.url() === 'about:blank') await page.goto('/#/buy/lists')
  const response = await page.request.post('/api/sync', { data: { collections: [{ id, name, updatedAt: now, deleted: false }], entries } })
  expect(response.ok()).toBe(true)
  // the app pulls the new collection with its sync on start: reload, and wait for that pull to
  // answer before looking (and before anything else navigates: an aborted request can leave the local
  // database's one connection stuck)
  await page.goto(`/#/buy/lists/${id}`)
  const pulled = page.waitForResponse(r => r.url().includes('/api/sync') && r.request().method() === 'GET')
  await page.reload()
  await pulled
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return id
}

/** Cascadia's player poll (votes), from tests/fixtures/bgg-xml/thing-295947-385318.xml */
export const CASCADIA_POLL = [
  { players: '1', best: 133, recommended: 439, notRecommended: 145 },
  { players: '2', best: 587, recommended: 334, notRecommended: 17 },
  { players: '3', best: 551, recommended: 324, notRecommended: 17 },
  { players: '4', best: 188, recommended: 552, notRecommended: 82 },
  { players: '4+', best: 2, recommended: 37, notRecommended: 455 },
]

export type FakeResult = { bggId: number; name: string; year: number | null; kind: 'boardgame' | 'expansion' }

/**
 * F006: BoardGameGeek search without BGG: `/api/me` says whether the server has the token, and
 * `/api/bgg/search` answers by the text (`results[q]`, else none); `status` makes it fail, `delayMs`
 * slows it (per text). Result games get covers-less details from `/api/bgg/games`.
 */
export async function fakeSearch(
  page: Page,
  options: { token?: boolean; results?: Record<string, FakeResult[]>; status?: number; delayMs?: Record<string, number> } = {},
) {
  const { token = true, results = {}, status, delayMs = {} } = options
  const all = new Map(Object.values(results).flat().map(r => [r.bggId, r]))
  await page.route('**/api/me', async route => {
    const res = await route.fetch()
    await route.fulfill({ response: res, json: { ...(await res.json()), bggSearch: token } })
  })
  await page.route('**/api/bgg/search?**', async route => {
    const url = new URL(route.request().url())
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const limit = Number(url.searchParams.get('limit') ?? 50)
    if (delayMs[q]) await new Promise(resolve => setTimeout(resolve, delayMs[q]))
    if (!token) return route.fulfill({ status: 503, json: { error: 'bgg_search_unavailable', message: 'No token.', retryable: false } })
    if (status) return route.fulfill({ status, json: { error: status === 503 ? 'bgg_rate_limited' : 'bgg_unavailable', message: 'BGG failed.', retryable: true } })
    await route.fulfill({ json: { query: q, results: (results[q] ?? []).slice(0, limit) } })
  })
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    if (!ids.some(i => all.has(i))) return route.fallback()
    const games = ids.flatMap(i => {
      const r = all.get(i)
      return r
        ? [{ bggId: i, name: r.name, year: r.year, thumbnailUrl: null, description: `About ${r.name}.`, kind: r.kind, minPlayers: 1, maxPlayers: 4, designers: ['Randy Flynn'], mechanisms: ['Tile Placement'], publisher: 'Flatout Games', rating: 7.88, geekRating: 7.73, bestWith: '2–3 players', recommendedWith: '1–4 players', playerPoll: CASCADIA_POLL, playerPollVoters: 1043 }]
        : []
    })
    await route.fulfill({ json: { games } })
  })
}

const offer = (o: Record<string, unknown>) => ({
  source: 'brettspielpreise', kind: 'new', seller: 'Shop in Germany', country: 'DE', title: 'Cascadia', language: 'de',
  price: { amount: 30, currency: 'EUR' }, shipping: 0, euroTotal: 30, available: true, condition: null, note: null,
  auction: null, listedAt: null, link: `https://brettspielpreise.de/item/go?storeitemid=${Math.random().toString(36).slice(2)}`, ...o,
})

/** F007: an answer of `/api/prices` for Cascadia (contracts/api.md of feature 007). */
export const CASCADIA_PRICES = {
  bggId: 295947,
  checkedAt: '2026-11-06T18:00:00.000Z',
  sources: ['brettspielpreise.de', 'BGG marketplace', 'unknowns.de'],
  failed: [] as string[],
  offers: [
    offer({ title: 'Cascadia (Kosmos)', price: { amount: 29.49, currency: 'EUR' }, shipping: 5.9, euroTotal: 35.39 }),
    offer({ title: 'Cascadia (Flatout Games)', language: 'en', price: { amount: 34.99, currency: 'EUR' }, shipping: 0, euroTotal: 34.99 }),
    offer({ title: 'Cascadia (Kosmos)', price: { amount: 33.9, currency: 'EUR' }, shipping: 0, euroTotal: 33.9, available: false }),
    offer({ seller: 'Shop in Belgium', country: 'BE', title: 'Cascadia', language: 'unknown', price: { amount: 27.99, currency: 'EUR' }, shipping: null, euroTotal: 27.99 }),
    offer({ source: 'bgg', kind: 'used', seller: 'BGG marketplace', country: null, title: null, language: 'en', price: { amount: 22, currency: 'EUR' }, shipping: null, euroTotal: 22, condition: 'like new', note: 'Played twice, sleeved.', listedAt: '2026-10-29', link: 'https://boardgamegeek.com/market/product/1' }),
    offer({ source: 'bgg', kind: 'used', seller: 'BGG marketplace', country: null, title: null, language: 'unknown', price: { amount: 25, currency: 'GBP' }, shipping: null, euroTotal: 29.41, condition: 'very good', note: 'Buyer pays shipping.', listedAt: '2026-10-30', link: 'https://boardgamegeek.com/market/product/2' }),
    offer({ source: 'unknowns', kind: 'used', seller: 'unknowns.de', title: 'Cascadia (deutsch) – 1x gespielt', price: { amount: 25, currency: 'EUR' }, shipping: null, euroTotal: 25, note: 'Cascadia, deutsche Ausgabe.', listedAt: '2026-11-06', link: 'https://unknowns.de/marketplace/entry/99999-cascadia-deutsch/' }),
  ],
  links: [
    { name: 'Kleinanzeigen', url: 'https://www.kleinanzeigen.de/s-cascadia/k0' },
    { name: 'eBay.de', url: 'https://www.ebay.de/sch/i.html?_nkw=Cascadia&_sacat=180349&LH_ItemCondition=3000' },
    { name: 'unknowns.de', url: 'https://unknowns.de/search/?q=Cascadia&type=com.viecode.marketplace.entry&sortField=time&sortOrder=DESC' },
  ],
  siteSearch: 'https://brettspielpreise.de/item/search?search=Cascadia',
}

/** F007: `/api/prices` without the sources: the given answer (default Cascadia's), optionally slowed. */
export async function fakePrices(page: Page, answer: Partial<typeof CASCADIA_PRICES> = {}, options: { delayMs?: number; asked?: string[] } = {}) {
  await page.route('**/api/prices?**', async route => {
    options.asked?.push(route.request().url())
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    await route.fulfill({ json: { ...CASCADIA_PRICES, ...answer } })
  })
}

/** F008: a status in the shape of `/api/bgg/collection` (contracts/api.md), all off unless given. */
export const bggStatus = (s: Record<string, unknown> = {}) => ({
  own: false, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null, ...s,
})

export type FakeCollectionItem = { bggId: number; name: string; year?: number | null; kind?: 'boardgame' | 'expansion'; status?: Record<string, unknown> }

/**
 * F008: `GET /api/bgg/collection?user=` without BGG: `collections[user]` answers, unknown users 404;
 * `preparingFor` answers `202 bgg_preparing` until that many ms passed since the first request.
 * `asked` collects the requested URLs (to check `fresh=1`).
 */
export async function fakeBggCollection(
  page: Page,
  collections: Record<string, FakeCollectionItem[]>,
  options: { preparingFor?: number; asked?: string[]; loadedAt?: string } = {},
) {
  let first: number | undefined
  await page.route('**/api/bgg/collection?**', async route => {
    const url = new URL(route.request().url())
    options.asked?.push(url.toString())
    const user = (url.searchParams.get('user') ?? '').toLowerCase()
    first ??= Date.now()
    if (options.preparingFor && Date.now() - first < options.preparingFor)
      return route.fulfill({ status: 202, headers: { 'Retry-After': '5' }, json: { error: 'bgg_preparing', message: 'BoardGameGeek is preparing this collection.', retryable: true } })
    const items = collections[user]
    if (!items) return route.fulfill({ status: 404, json: { error: 'not_found', message: 'BoardGameGeek has no such user.', retryable: false } })
    await route.fulfill({
      json: {
        bggUser: user,
        loadedAt: options.loadedAt ?? new Date().toISOString(),
        items: items.map(i => ({ year: null, thumbnailUrl: null, kind: 'boardgame', ...i, status: bggStatus(i.status) })),
      },
    })
  })
}

/**
 * F008: the BGG account routes without BGG (contracts/api.md): sign-in state, sign-in (password
 * "wrong" fails), sign-out and saves. `saves` collects the bodies of `POST …/collection/<bggId>`;
 * `saveStatus` makes saves fail; `priceConflict` answers 409 until `replacePrice` is sent.
 */
export async function fakeBggAccount(
  page: Page,
  options: {
    signedIn?: boolean
    bggUser?: string
    saves?: unknown[]
    saveStatus?: number
    priceConflict?: { amount: number; currency: string }
    /** What BGG holds before the saves, by game (a save merges into it, as the Worker does). */
    statuses?: Record<number, Record<string, unknown>>
  } = {},
) {
  const state = { signedIn: options.signedIn ?? false, bggUser: options.bggUser ?? 'mrmikkl' }
  const statuses = new Map<number, Record<string, unknown>>(Object.entries(options.statuses ?? {}).map(([id, s]) => [Number(id), s]))
  await page.route('**/api/bgg/account', route => route.fulfill({ json: state.signedIn ? state : { signedIn: false } }))
  await page.route('**/api/bgg/account/signin', async route => {
    const body = route.request().postDataJSON() as { username: string; password: string }
    if (body.password === 'wrong')
      return route.fulfill({ status: 401, json: { error: 'bgg_signed_out', message: 'BoardGameGeek did not accept this username or password.', retryable: false } })
    Object.assign(state, { signedIn: true, bggUser: body.username.toLowerCase() })
    await route.fulfill({ json: state })
  })
  await page.route('**/api/bgg/account/signout', async route => {
    state.signedIn = false
    await route.fulfill({ json: { signedIn: false } })
  })
  await page.route('**/api/bgg/account/collection/*', async route => {
    const bggId = Number(new URL(route.request().url()).pathname.split('/').pop())
    const body = route.request().postDataJSON() as { status?: Record<string, unknown>; replacePrice?: boolean }
    options.saves?.push(body)
    if (!state.signedIn) return route.fulfill({ status: 401, json: { error: 'bgg_signed_out', message: 'Sign in to BoardGameGeek.', retryable: false } })
    if (options.saveStatus) return route.fulfill({ status: options.saveStatus, json: { error: 'bgg_refused', message: 'BoardGameGeek did not take the change.', retryable: true } })
    if (options.priceConflict && body.replacePrice === undefined && 'privateInfo' in body)
      return route.fulfill({ status: 409, json: { error: 'price_conflict', message: 'BoardGameGeek already has a price paid.', retryable: false, current: options.priceConflict } })
    const next = { ...bggStatus(statuses.get(bggId)), ...body.status }
    statuses.set(bggId, next)
    await route.fulfill({ json: { bggId, status: next } })
  })
}

/**
 * F008: keeps the BGG username and followed friends on this test's device. All tests share one dev
 * user, so a synced username would reach every other test running at the same time: pushes drop
 * `settings` and `follows`, pulls leave them out.
 */
export async function keepBggSettingsLocal(page: Page) {
  await page.route('**/api/sync**', async route => {
    const request = route.request()
    try {
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>
        delete body.settings
        delete body.follows
        // nothing else in it: the server would refuse an empty push, so it is answered here
        const empty = ['collections', 'entries', 'lists'].every(key => !Array.isArray(body[key]) || (body[key] as unknown[]).length === 0)
        if (empty) return await route.fulfill({ json: { applied: 0, ignored: 0 } })
        return await route.continue({ postData: JSON.stringify(body) })
      }
      const response = await route.fetch()
      if (!response.ok()) return await route.fulfill({ response })
      const json = (await response.json()) as Record<string, unknown>
      delete json.settings
      delete json.follows
      await route.fulfill({ response, json })
    } catch {
      // the test ended while the request was on its way
    }
  })
}

/** F008: Config › BoardGameGeek › "Your BGG username" and Save username (call `keepBggSettingsLocal` first). */
export async function setBggUsername(page: Page, name: string) {
  await page.goto('/#/config')
  const field = page.getByLabel('Your BGG username')
  await field.fill(name)
  await page.getByRole('button', { name: 'Save username' }).click()
  await expect(page.getByRole('status').filter({ hasText: name ? 'Saved your BGG username' : 'Removed your BGG username' })).toBeVisible()
}

/** F008: `/api/bgg/games` without BGG for games the test does not know: an empty answer. */
export async function fakeNoGameDetails(page: Page) {
  await page.route('**/api/bgg/games?**', route => route.fulfill({ json: { games: [] } }))
}

/**
 * F009: the length limits on this test's device, written straight into the store's meta `bggSetting`
 * (as `store.setLengthLimits` keeps them, without queuing a push); reloads so the app reads them. Call
 * `keepBggSettingsLocal` first, so no pull replaces them.
 */
export async function setLengthLimitsOnDevice(page: Page, limits: [number, number, number]) {
  await page.evaluate(async limits => {
    const { email } = (await (await fetch('/api/me')).json()) as { email: string }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(`board-a-licious-${email.toLowerCase()}`)
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite')
      const meta = tx.objectStore('meta')
      const read = meta.get('bggSetting')
      read.onsuccess = () => {
        const current = (read.result ?? { bggUsername: null }) as Record<string, unknown>
        meta.put({ ...current, lengthLimits: limits, updatedAt: new Date().toISOString() }, 'bggSetting')
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, limits)
  await page.reload()
}
