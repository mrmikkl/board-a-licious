import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

/**
 * The SPIEL preview (3 pages in the fixtures) from fixtures instead of BGG. Page 2 waits until the
 * test releases it, so the progress can be seen; page 3 fails once, so the paused state can be seen.
 */
async function fakeLists(page: Page) {
  let release!: () => void
  const page2 = new Promise<void>(resolve => (release = resolve))
  let page3Calls = 0
  await page.route('**/api/bgg/lists/preview/93?**', async route => {
    const n = Number(new URL(route.request().url()).searchParams.get('page') ?? 1)
    if (n === 2) await page2
    if (n === 3 && ++page3Calls === 1) {
      return route.fulfill({ status: 503, json: { error: 'bgg_unavailable', message: 'BoardGameGeek is not reachable.', retryable: true } })
    }
    await route.fulfill({ json: apiFixture(`preview-93-page-${n}.json`) })
  })
  await page.route('**/api/bgg/companies?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const { companies } = apiFixture('companies.json') as { companies: { id: number }[] }
    await route.fulfill({ json: { companies: companies.filter(c => ids.includes(c.id)) } })
  })
  // a person who has loaded no lists yet: lists synced from other test runs (same dev user) are hidden
  await page.route('**/api/sync**', async route => {
    if (route.request().method() !== 'GET') return route.continue()
    try {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...(await response.json()), lists: [] } })
    } catch {
      // the test ended while a sync was still on its way
    }
  })
  await page.route('**/api/bgg/lists/geeklist/404404?**', route =>
    route.fulfill({ status: 404, json: { error: 'not_found', message: 'This list does not exist.', retryable: false } }),
  )
  return { releasePage2: () => release() }
}

async function createCollection(page: Page, name: string) {
  await page.goto('/#/add/collection')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('US2: load the SPIEL preview, browse and filter it, put a game into collections', async ({ page }) => {
  await fakeBgg(page)
  const lists = await fakeLists(page)
  const essen = unique('Essen fair')
  const standard = unique('Wishlist')
  await createCollection(page, essen)
  await createCollection(page, standard)

  // Lists: empty on a new device, with the SPIEL preview link as example
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lists' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BGG lists' })).toBeVisible()
  await expect(page.getByText(/geekpreview\/93/)).toBeVisible()
  await expectAccessible(page)

  // Add (+) ↳ BGG list: "Load list" stays disabled until the link is a preview or geeklist
  await page.getByRole('link', { name: /load a bgg list/i }).first().click()
  const link = page.getByLabel(/bgg list link/i)
  const load = page.getByRole('button', { name: 'Load list' })
  await link.fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await expect(load).toBeDisabled()
  await expect(page.getByText(/paste a link to a boardgamegeek preview or geeklist/i)).toBeVisible()
  await link.fill('https://boardgamegeek.com/geeklist/66420/top-games')
  await expect(page.getByText(/^geeklist: games without booth and price/i)).toBeVisible()
  await link.fill('https://boardgamegeek.com/geekpreview/93/spiel-essen-2026')
  await expect(page.getByText(/^preview: games with booth, price, publisher and edition/i)).toBeVisible()
  await expectAccessible(page)
  await load.click()

  // List: the first page appears at once, the rest follows with visible progress
  await expect(page.getByRole('heading', { level: 1, name: 'SPIEL Essen 2026' })).toBeVisible()
  const kalypso = page.getByRole('button', { name: /^kalypso/i })
  await expect(kalypso).toBeVisible({ timeout: 10_000 })
  await expect(kalypso).toContainText('…')
  await expect(kalypso).toContainText('€60 · Booth 3-R400')
  await expect(page.getByText('Loading 1 of 3 pages')).toBeVisible()
  await expectAccessible(page)

  lists.releasePage2()
  await expect(page.getByRole('button', { name: /^brumble quest/i })).toBeVisible()
  await expect(page.getByText(/boardgamegeek is not reachable/i)).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('button', { name: /^shape it/i })).toBeVisible()
  await expect(kalypso).toContainText('Inside Up Games')
  await expect(page.getByText(/loading \d+ of 3 pages/i)).toHaveCount(0)

  // name filter
  const filter = page.getByLabel(/filter this list/i)
  await filter.fill('trick')
  await expect(page.getByRole('button', { name: /^tricky traps/i })).toBeVisible()
  await expect(kalypso).toBeHidden()
  await filter.fill('nothing like this')
  await expect(page.getByText(/no game on this list matches/i)).toBeVisible()
  await filter.fill('')

  // List game sheet: ticks change nothing until Done; Cancel discards
  await page.getByRole('button', { name: 'Add Kalypso to a collection' }).click()
  const sheet = page.getByRole('dialog', { name: 'Kalypso' })
  await expect(sheet.getByText(/description is filled in from boardgamegeek later/i)).toBeVisible()
  const essenTick = sheet.getByRole('checkbox', { name: essen })
  const standardTick = sheet.getByRole('checkbox', { name: standard })
  await expect(essenTick).not.toBeChecked()
  await essenTick.check()
  await expect(sheet.getByText(/^will be added$/i)).toBeVisible()
  await standardTick.check()
  await expect(sheet.getByText(/^will be added$/i)).toHaveCount(2)
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()

  // Done adds exactly as ticked (other test runs share the dev database, so only these two collections count)
  await kalypso.click()
  await expect(essenTick).not.toBeChecked()
  await expect(standardTick).not.toBeChecked()
  await essenTick.check()
  await standardTick.check()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toBeHidden()
  await expect(kalypso).toContainText('in a collection')

  // booth, price and publisher in both collections (FR-010)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Collections' }).click()
  for (const name of [essen, standard]) {
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('button', { name: /^kalypso/i })).toContainText('Inside Up Games')
    await expect(page.getByRole('button', { name: /^kalypso/i })).toContainText('€60 · Booth 3-R400')
    await page.goBack()
  }

  // the list is remembered on the device; Done also removes what was unticked
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lists' }).click()
  const card = page.getByRole('link', { name: /spiel essen 2026/i })
  await expect(card).toContainText('5 games')
  await expectAccessible(page)
  await card.click()
  await kalypso.click()
  await expect(essenTick).toBeChecked()
  await expect(standardTick).toBeChecked()
  await standardTick.uncheck()
  await expect(sheet.getByText(/will be removed, including its mark/i)).toBeVisible()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await kalypso.click()
  await expect(essenTick).toBeChecked()
  await expect(standardTick).not.toBeChecked()
})

test('US2: a list that does not exist says so', async ({ page }) => {
  await fakeLists(page)
  await page.goto('/#/lists/geeklist/404404')
  await expect(page.getByText(/this list does not exist on boardgamegeek/i)).toBeVisible()
  await expectAccessible(page)
})
