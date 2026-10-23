import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, goTo, loadList, seedCollection, unique } from './helpers.ts'

const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

const PREVIEW = 'https://boardgamegeek.com/geekpreview/93/spiel-essen-2026'

/**
 * What BGG says about the test's own game, which is on page 1 of the SPIEL preview: its booth
 * (changed by the test) and a price the collection does not have. A game id of its own keeps other
 * test runs (which share the dev database) out of the counts.
 */
type Bgg = { booth: string; failing: boolean; gate?: Promise<void>; gameId: number; gameName: string }

async function fakeSpiel(page: Page, bgg: Bgg) {
  await page.route('**/api/bgg/lists/preview/93?**', async route => {
    const n = Number(new URL(route.request().url()).searchParams.get('page') ?? 1)
    if (bgg.failing) {
      return route.fulfill({ status: 503, json: { error: 'bgg_unavailable', message: 'BoardGameGeek is not reachable.', retryable: true } })
    }
    if (n === 2 && bgg.gate) await bgg.gate
    const body = apiFixture(`preview-93-page-${n}.json`)
    if (n === 1) {
      body.entries.push({
        position: 11,
        bggId: bgg.gameId,
        name: bgg.gameName,
        thumbnailUrl: null,
        facts: { booth: bgg.booth, priceCents: 1200, currency: 'EUR', publisherId: null, publisher: 'Feuerland' },
      })
    }
    await route.fulfill({ json: body })
  })
  await page.route('**/api/bgg/companies?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const { companies } = apiFixture('companies.json') as { companies: { id: number }[] }
    await route.fulfill({ json: { companies: companies.filter(c => ids.includes(c.id)) } })
  })
}

/**
 * A collection with the test's game, its booth typed in by hand (3-R400) and no price yet, then the
 * SPIEL preview loaded: BGG's booth for the game is `booth`.
 */
async function setUp(page: Page, booth = '3-A100') {
  await fakeBgg(page)
  // a game of its own per test: resync reconciles every collection of the (shared) test user
  const bgg: Bgg = { booth, failing: false, gameId: 1_000_000 + Math.floor(Math.random() * 900_000), gameName: unique('Resync game') }
  await fakeSpiel(page, bgg)
  const collection = unique('Essen resync')
  await seedCollection(page, collection, [{ bggId: bgg.gameId, name: bgg.gameName, mark: 'must_have', booth: '3-R400', factsSource: 'manual' }])
  await loadList(page, PREVIEW)
  await expect(page.getByRole('heading', { level: 1, name: 'SPIEL Essen 2026' })).toBeVisible()
  await expect(page.getByText(/loading \d+ of 3 pages/i)).toHaveCount(0)
  return { bgg, collection }
}

const resync = (page: Page) => page.getByRole('button', { name: 'Resync with BGG' }).click()

/** The game's booth as its collection row shows it, then back to the list it was checked from. */
async function expectBoothInCollection(page: Page, { collection, bgg }: { collection: string; bgg: Bgg }, booth: string) {
  const listUrl = page.url()
  await goTo(page, 'Collections')
  await page.getByRole('link', { name: new RegExp(collection) }).click()
  await expect(page.getByRole('button', { name: new RegExp(bgg.gameName) })).toContainText(`Booth ${booth}`)
  await page.goto(listUrl)
  await expect(page.getByRole('heading', { level: 1, name: 'SPIEL Essen 2026' })).toBeVisible()
}

test('US5: a resync fills the empty price and asks about a booth typed in by hand; Use BGG for all moves the game', async ({ page }) => {
  test.setTimeout(60_000)
  const game = await setUp(page)

  await resync(page)
  await expect(page.getByText('Resync done: 1 game updated, 1 conflict')).toBeVisible()
  const conflicts = page.getByRole('dialog', { name: 'Conflicts' })
  await expect(conflicts.getByText('1 conflict', { exact: true })).toBeVisible()
  await expect(conflicts.getByRole('button', { name: 'Own 3-R400' })).toHaveAttribute('aria-pressed', 'true')
  await expect(conflicts.getByRole('button', { name: 'BGG 3-A100' })).toHaveAttribute('aria-pressed', 'false')
  await expectAccessible(page)

  await conflicts.getByRole('button', { name: 'Use BGG for all' }).click()
  await expect(conflicts).toBeHidden()
  await expect(page.getByText('1 value taken from BGG')).toBeVisible()
  await expectBoothInCollection(page, game, '3-A100')
})

test('US5: Later keeps the own booth, and the next resync asks again', async ({ page }) => {
  test.setTimeout(60_000)
  const game = await setUp(page)

  await resync(page)
  const conflicts = page.getByRole('dialog', { name: 'Conflicts' })
  await expect(conflicts).toBeVisible()
  await conflicts.getByRole('button', { name: 'Later' }).click()
  await expect(conflicts).toBeHidden()
  await expectBoothInCollection(page, game, '3-R400')

  await resync(page)
  await expect(page.getByRole('dialog', { name: 'Conflicts' })).toBeVisible()
})

test('US5: Use own for all settles the conflicts until BGG changes its booth', async ({ page }) => {
  test.setTimeout(60_000)
  const game = await setUp(page)
  const { bgg } = game

  await resync(page)
  const conflicts = page.getByRole('dialog', { name: 'Conflicts' })
  await conflicts.getByRole('button', { name: 'Use own for all' }).click()
  await expect(conflicts).toBeHidden()
  await expectBoothInCollection(page, game, '3-R400')

  // BGG's value is the same: no conflict, nothing to update
  await resync(page)
  await expect(page.getByText('Resync done: 0 games updated')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Conflicts' })).toBeHidden()

  // BGG now says another booth: the conflict is offered again
  bgg.booth = '3-A101'
  await resync(page)
  await expect(page.getByRole('dialog', { name: 'Conflicts' }).getByRole('button', { name: 'BGG 3-A101' })).toBeVisible()
})

test('US5: while it runs the resync shows its progress and cannot be started again; offline it is disabled', async ({ page, context }) => {
  test.setTimeout(60_000)
  const { bgg } = await setUp(page)
  let release!: () => void
  bgg.gate = new Promise<void>(resolve => (release = resolve))

  await resync(page)
  await expect(page.getByText('Resyncing with BGG… 1 / 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resync with BGG' })).toBeDisabled()
  release()
  await expect(page.getByText('Resyncing with BGG…')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Conflicts' })).toBeVisible()

  await context.setOffline(true)
  await expect(page.getByRole('button', { name: 'Resync with BGG' })).toBeDisabled()
  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Resync with BGG' })).toBeEnabled()
})

test('US5: BoardGameGeek busy: a message, and nothing changes', async ({ page }) => {
  test.setTimeout(60_000)
  const game = await setUp(page)
  const { bgg } = game
  bgg.failing = true

  await resync(page)
  await expect(page.getByText('BoardGameGeek is busy. Try the resync again in a minute.')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Conflicts' })).toBeHidden()
  await expectBoothInCollection(page, game, '3-R400')
})
