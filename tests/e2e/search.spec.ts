import { expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakeSearch, seedCollection, unique } from './helpers.ts'

/** Ids of their own per run, so data read across collections does not meet other runs' games (CLAUDE.md). */
const BASE = 2_000_000 + Math.floor(Math.random() * 1_000_000) * 100
const CASCADIA: FakeResult = { bggId: BASE + 1, name: 'Cascadia', year: 2021, kind: 'boardgame' }
const LANDMARKS: FakeResult = { bggId: BASE + 2, name: 'Cascadia: Landmarks', year: 2023, kind: 'expansion' }
const PROMO: FakeResult = { bggId: BASE + 3, name: 'Cascadia: Promo Cards', year: null, kind: 'expansion' }
const HARMONIES: FakeResult = { bggId: BASE + 4, name: 'Harmonies', year: 2024, kind: 'boardgame' }
const MANY = Array.from({ length: 50 }, (_, i): FakeResult => ({ bggId: BASE + 10 + i, name: `The Game ${i + 1}`, year: 2000 + (i % 26), kind: 'boardgame' }))
const results = { cascad: [CASCADIA, LANDMARKS, PROMO], harmon: [HARMONIES], the: MANY }

const field = (page: import('@playwright/test').Page) => page.getByRole('searchbox', { name: 'Find a game' })

test.describe('F006 US1: find a game by its name', () => {
  test('the field is ready, with the hint and no action bar', async ({ page }) => {
    await fakeSearch(page, { results })
    await page.goto('/#/buy')
    await expect(field(page)).toBeEnabled()
    await expect(field(page)).toHaveAttribute('placeholder', 'Game name, e.g. Cascadia')
    await expect(page.getByText('Type at least 2 letters.')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)
    await expectAccessible(page)
  })

  test('results show year, Expansion and where the game already is; no Add (Buy › Search is about prices)', async ({ page }) => {
    await fakeSearch(page, { results })
    const name = unique('Essen 2026')
    await seedCollection(page, name, [{ bggId: CASCADIA.bggId, name: 'Cascadia', mark: 'interested' }])
    await page.goto('/#/buy')
    await field(page).fill('cascad')
    await expect(page.getByRole('status').filter({ hasText: '3 games · exact matches first' })).toBeVisible()
    const cascadia = page.getByRole('button', { name: 'Cascadia, 2021', exact: true })
    await expect(cascadia).toBeVisible()
    await expect(cascadia).toHaveAccessibleDescription(`in ${name}`)
    await expect(page.getByRole('button', { name: 'Cascadia: Landmarks, 2023, expansion' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cascadia: Promo Cards, Year unknown, expansion' })).toBeVisible()
    await expectAccessible(page)

    await expect(page.getByRole('button', { name: 'Add Cascadia: Landmarks to shopping lists' })).toHaveCount(0)
  })

  test('results load no details; opening a game loads only its own', async ({ page }) => {
    await fakeSearch(page, { results })
    const asked: string[] = []
    const mine = new Set([String(HARMONIES.bggId)])
    // the app also completes details of the (shared) test user's collections; only result ids count here
    page.on('request', r => {
      if (!r.url().includes('/api/bgg/games')) return
      const ids = (new URL(r.url()).searchParams.get('ids') ?? '').split(',').filter(id => mine.has(id))
      if (ids.length) asked.push(ids.join(','))
    })
    await page.goto('/#/buy')
    await field(page).fill('harmon')
    await expect(page.getByRole('button', { name: 'Harmonies, 2024' })).toBeVisible()
    await page.waitForTimeout(500)
    expect(asked).toEqual([])
    await page.getByRole('button', { name: 'Harmonies, 2024' }).click()
    await expect(page.getByRole('dialog', { name: 'Harmonies' }).getByText('From BoardGameGeek', { exact: true })).toBeVisible()
    expect(asked).toEqual([String(HARMONIES.bggId)])
  })

  test('tapping a game opens its game sheet: info, no shopping list ticks, no category', async ({ page }) => {
    await fakeSearch(page, { results })
    await page.goto('/#/buy')
    await field(page).fill('cascad')
    await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Cascadia' })
    await expect(sheet.getByRole('button', { name: 'Show the images of Cascadia big' })).toBeVisible()
    await expect(sheet.getByText('2021 · Flatout Games')).toBeVisible()
    await expect(sheet.getByRole('link', { name: 'Open on BoardGameGeek' })).toBeVisible()
    await expect(sheet.getByText('From BoardGameGeek')).toBeVisible()
    // F008 feedback: Best with, Recommended and the votes are the folded Players section, not in the info box
    await expect(sheet.locator('.facts-box').getByRole('term').filter({ hasText: /^Best with$/ })).toHaveCount(0)
    const players = sheet.getByRole('button', { name: /^Players/ })
    await expect(players).toHaveAttribute('aria-expanded', 'false')
    await expect(players).toContainText('Best 2–3')
    await expect(sheet.getByRole('table')).toBeHidden()
    await players.click()
    await expect(sheet.getByRole('definition').filter({ hasText: '2–3 players' })).toBeVisible()
    await expect(sheet.getByRole('term').filter({ hasText: /^Best with$/ })).toBeVisible()
    await expect(sheet.getByRole('term').filter({ hasText: /^Recommended$/ })).toBeVisible()
    // FR-006b: the votes as a table in percent, the highest of each column bold
    const table = sheet.getByRole('table', { name: /votes on boardgamegeek per number of players/i })
    await expect(table).toBeVisible()
    await expect(table.getByRole('row', { name: /^2 / })).toContainText('63%')
    await expect(table.locator('b')).toHaveText(['63%', '67%', '92%'])
    await expect(sheet.getByText('1,043 votes on BoardGameGeek')).toBeVisible()
    await expectAccessible(page)
    await expect(sheet.getByRole('checkbox')).toHaveCount(0)
    await expect(sheet.getByRole('group', { name: 'Category' })).toHaveCount(0)
    await expectAccessible(page)
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(sheet).toHaveCount(0)
  })

  test('no match, and 50 results with the note to narrow it down', async ({ page }) => {
    await fakeSearch(page, { results })
    await page.goto('/#/buy')
    await field(page).fill('zzz')
    await expect(page.getByRole('heading', { name: 'No game called “zzz” on BoardGameGeek' })).toBeVisible()
    await expect(page.getByText('Check the spelling, or try a shorter part of the name.')).toBeVisible()
    await expectAccessible(page)
    await field(page).fill('the')
    await expect(page.getByRole('status').filter({ hasText: '50 games · the first 50, exact matches first' })).toBeVisible()
    await expect(page.getByText('More games match. Type more of the name to narrow it down.')).toBeVisible()
  })

  test('one letter asks for more', async ({ page }) => {
    await fakeSearch(page, { results })
    await page.goto('/#/buy')
    await field(page).fill('c')
    await expect(page.getByRole('status').filter({ hasText: 'Type at least 2 letters.' })).toBeVisible()
  })

  test('BoardGameGeek not reachable shows a note with Try again', async ({ page }) => {
    await fakeSearch(page, { results, status: 502 })
    await page.goto('/#/buy')
    await field(page).fill('cascad')
    await expect(page.getByText('BoardGameGeek is not reachable. Try again in a moment.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expectAccessible(page)
  })

  test('offline shows a note with Try again', async ({ page, context }) => {
    await fakeSearch(page, { results })
    await page.goto('/#/buy')
    await context.setOffline(true)
    await field(page).fill('cascad')
    await expect(page.getByText("You're offline. Searching needs a connection.")).toBeVisible()
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Cascadia, 2021', exact: true })).toBeVisible()
  })

  test('an older answer arriving late does not replace the newer one (US1-7)', async ({ page }) => {
    await fakeSearch(page, { results, delayMs: { cascad: 2500 } })
    await page.goto('/#/buy')
    await field(page).fill('cascad')
    await page.waitForRequest(r => r.url().includes('/api/bgg/search?q=cascad'))
    await field(page).fill('harmon')
    await expect(page.getByRole('button', { name: 'Harmonies, 2024' })).toBeVisible()
    await page.waitForTimeout(2600)
    await expect(page.getByRole('button', { name: 'Harmonies, 2024' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cascadia, 2021', exact: true })).toHaveCount(0)
  })

  test('without the token the field is disabled and says why, still without an action bar', async ({ page }) => {
    await fakeSearch(page, { token: false })
    await page.goto('/#/buy')
    await expect(page.getByText(/Searching all of BoardGameGeek needs official access/)).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Find a game' })).toBeDisabled()
    await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)
  })
})
