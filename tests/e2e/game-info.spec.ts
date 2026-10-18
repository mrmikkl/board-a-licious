import { expect, test } from '@playwright/test'

import { expectAccessible, unique } from './helpers.ts'

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
  await page.goto('/#/add/collection')
  const name = unique('Info')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
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
