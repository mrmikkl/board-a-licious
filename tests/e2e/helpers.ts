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

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
}

/** F003 navigation (contracts/navigation.md): the four places live in the app bar's menu. */
export type Place = 'Collections' | 'BGG lists' | 'Search' | 'Config'

export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible()
}

export async function goTo(page: Page, place: Place) {
  await openMenu(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: place, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: place, exact: true })).toBeVisible()
}

/** The big hexagon in the action bar; its accessible name says what it does on the screen. */
export const mainButton = (page: Page) => page.getByRole('navigation', { name: 'Actions' }).locator('.main-btn')

/** Collections → main ＋ → New collection sheet → Create collection; ends in the new collection. */
export async function createCollection(page: Page, name: string) {
  if (page.url() === 'about:blank') await page.goto('/#/collections')
  await goTo(page, 'Collections')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'New collection' })
  await sheet.getByLabel('Name').fill(name)
  await sheet.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** BGG lists → main ＋ → Load a BGG list sheet → Load list; ends in the list. */
export async function loadList(page: Page, link: string) {
  if (page.url() === 'about:blank') await page.goto('/#/lists')
  await goTo(page, 'BGG lists')
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
  if (page.url() === 'about:blank') await page.goto('/#/collections')
  const response = await page.request.post('/api/sync', { data: { collections: [{ id, name, updatedAt: now, deleted: false }], entries } })
  expect(response.ok()).toBe(true)
  await page.goto(`/#/collections/${id}`)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return id
}
