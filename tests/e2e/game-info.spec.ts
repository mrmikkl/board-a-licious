import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { RATINGS_295947, createCollection, expectAccessible, mainButton, unique } from './helpers.ts'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

const cascadia = {
  bggId: 295947,
  name: 'Cascadia',
  year: 2021,
  thumbnailUrl: null,
  description: 'Habitats and wildlife.',
  kind: 'boardgame',
  minPlayers: 1,
  maxPlayers: 4,
  designers: ['Randy Flynn'],
  mechanisms: ['Drafting', 'Hexagon Grid', 'Tile Placement'],
  publisher: 'Flatout Games',
}

test('game rows show publisher and three infos; the details show all of them (FR-010)', async ({ page }) => {
  await page.route('**/api/bgg/games?**', route => route.fulfill({ json: { games: [cascadia] } }))
  await createCollection(page, unique('Info'))
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await page.getByRole('button', { name: 'Add to collection' }).click()

  // no price, booth or edition: players, designer and the mechanisms as pills
  const row = page.getByRole('button', { name: /cascadia/i }).first()
  await expect(row).toContainText('Flatout Games')
  await expect(row).toContainText('1–4 players · Randy Flynn')
  await expect(row.locator('.info-pill')).toHaveCount(3)

  // typed-in price and booth come first, so the mechanisms drop out of the row
  await row.click()
  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await sheet.getByRole('button', { name: /add booth, price and publisher/i }).click()
  await sheet.getByLabel('Booth').fill('3-A101')
  await sheet.getByLabel(/price/i).first().fill('40')
  await sheet.getByRole('button', { name: /save/i }).first().click()
  for (const text of ['Flatout Games', '€40', '1–4 players', '3-A101', 'Randy Flynn', 'Hexagon Grid']) await expect(sheet).toContainText(text)
  await expectAccessible(page)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(row).toContainText('€40 · 1–4 players · Booth 3-A101')
  await expect(row.locator('.info-pill')).toHaveCount(0)
})

async function addCascadia(page: Page, game: object) {
  await page.route('**/api/bgg/games?**', route => route.fulfill({ json: { games: [game] } }))
  await createCollection(page, unique('Info'))
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await page.getByRole('button', { name: 'Add to collection' }).click()
}

test('details show Rating 7.9 and Geek rating 7.7; rows show no ratings (FR-010, R1)', async ({ page }) => {
  await addCascadia(page, { ...cascadia, ...RATINGS_295947 })
  const row = page.getByRole('button', { name: /cascadia/i }).first()
  await expect(row).toContainText('1–4 players · Randy Flynn')
  await expect(row).not.toContainText('7.9')

  await row.click()
  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet.getByText('Rating', { exact: true })).toBeVisible()
  await expect(sheet.getByText('7.9', { exact: true })).toBeVisible()
  await expect(sheet.getByText('Geek rating', { exact: true })).toBeVisible()
  await expect(sheet.getByText('7.7', { exact: true })).toBeVisible()
  await expectAccessible(page)
})

test('a game without ratings shows neither rating (FR-010)', async ({ page }) => {
  await addCascadia(page, { ...cascadia, rating: null, geekRating: null })
  await page.getByRole('button', { name: /cascadia/i }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet).toContainText('Randy Flynn')
  await expect(sheet.getByText('Rating', { exact: true })).toHaveCount(0)
  await expect(sheet.getByText('Geek rating', { exact: true })).toHaveCount(0)
})

test('BG-Tinder card: publisher · year, the info box with ratings, the full description (FR-012, FR-012a)', async ({ page }) => {
  const description = 'Create the most harmonious ecosystem as you draft tiles and wildlife tokens, one turn after another. '.repeat(3).trim()
  await page.route('**/api/bgg/lists/preview/9093?**', route => {
    const n = new URL(route.request().url()).searchParams.get('page')
    return route.fulfill({ json: fixture(`preview-9093-page-${n}.json`) })
  })
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const games = fixture('games-9093.json').games
      .filter((g: { bggId: number }) => ids.includes(g.bggId))
      .map((g: { bggId: number }) => (g.bggId === 295947 ? { ...g, description, minPlayers: 1, maxPlayers: 4, ...RATINGS_295947 } : g))
    await route.fulfill({ json: { games } })
  })

  await createCollection(page, unique('Tinder'))
  await mainButton(page).click()
  const picker = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  await picker.getByRole('button', { name: 'Add new list' }).click()
  await picker.getByLabel(/bgg list link/i).fill('https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await picker.getByRole('button', { name: 'Load list' }).click()

  // Kalypso is on top; passing it brings Cascadia
  await expect(page.getByRole('group', { name: 'Game: Kalypso' })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  const card = page.getByRole('group', { name: 'Game: Cascadia' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Kosmos · 2021') // the list's publisher at the booth wins over BGG's
  const box = card.locator('.facts-box')
  await expect(box.getByText('Players', { exact: true })).toBeVisible()
  await expect(box.getByText('Rating', { exact: true })).toBeVisible()
  await expect(box.getByText('7.9', { exact: true })).toBeVisible()
  await expect(box.getByText('Geek rating', { exact: true })).toBeVisible()
  await expect(box.getByText('7.7', { exact: true })).toBeVisible()
  await expect(card.locator('.swipe-desc')).toHaveText(description)
  await expect(card.locator('.swipe-desc')).toBeVisible()
})
