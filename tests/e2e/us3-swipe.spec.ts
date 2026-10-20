import { readFileSync } from 'node:fs'

import { type Locator, type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, mainButton, unique } from './helpers.ts'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

/** The preview answers from fixtures; page 2 waits until the test releases it. */
async function fakePreview(page: Page) {
  let release!: () => void
  const page2 = new Promise<void>(resolve => (release = resolve))
  await page.route('**/api/bgg/lists/preview/9093?**', async route => {
    const n = new URL(route.request().url()).searchParams.get('page')
    if (n === '2') await page2
    await route.fulfill({ json: fixture(`preview-9093-page-${n}.json`) })
  })
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const games = fixture('games-9093.json').games.filter((g: { bggId: number }) => ids.includes(g.bggId))
    await route.fulfill({ json: { games } })
  })
  return release
}

async function drag(page: Page, card: Locator, dx: number) {
  const box = (await card.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  await page.mouse.up()
}

test('US3: swipe a BGG preview into a collection', async ({ page }) => {
  const releasePage2 = await fakePreview(page)
  const name = unique('Swipe')
  await createCollection(page, name)

  // ♥ BG-Tinder: pick the list by its link
  await mainButton(page).click()
  const picker = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  await expect(picker).toBeVisible()
  await expectAccessible(page)
  await picker.getByRole('button', { name: 'Add new list' }).click()
  await picker.getByLabel(/bgg list link/i).fill('https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await picker.getByRole('button', { name: 'Load list' }).click()

  const card = page.getByRole('group', { name: /^game:/i })
  await expect(page.getByRole('heading', { level: 1, name: `Add to ${name}` })).toBeVisible()
  await expect(page.getByText('Right adds the game, left passes on it.')).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Kalypso' })).toBeVisible()
  await expect(card).toContainText('2026')
  await expect(card).toContainText('Salvage debris')
  await expect(card).toContainText('3-R400')
  await expect(card).toContainText('€60')
  await expect(card).toContainText('Inside Up Games')
  await expect(page.getByText(/3 games left/)).toBeVisible()
  await expect(page.locator('[aria-live]').filter({ hasText: /Kalypso, 2026/ })).toHaveCount(1)
  await expectAccessible(page)

  // drag right adds, ✕ says not interested, arrow keys do the same
  await drag(page, card, 160)
  await expect(page.locator('[aria-live]').filter({ hasText: 'Added Kalypso' })).toHaveCount(1)
  await expect(card.getByRole('heading', { name: 'Cascadia' })).toBeVisible()

  await page.getByRole('button', { name: 'Not interested' }).click()
  await expect(page.locator('[aria-live]').filter({ hasText: 'Cascadia: not interested' })).toHaveCount(1)
  await expect(card.getByRole('heading', { name: 'Harmonies' })).toBeVisible()

  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[aria-live]').filter({ hasText: 'Added Harmonies' })).toHaveCount(1)

  // page 2 still loading: a loading card follows the last loaded game
  await expect(page.getByText('Loading more games…')).toBeVisible()
  releasePage2()
  await expect(card.getByRole('heading', { name: 'Arcs' })).toBeVisible({ timeout: 10_000 })

  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[aria-live]').filter({ hasText: 'Arcs: not interested' })).toHaveCount(1)
  await expect(card.getByRole('heading', { name: 'Faraway' })).toBeVisible()
  await drag(page, card, -160)
  await expect(page.locator('[aria-live]').filter({ hasText: 'Faraway: not interested' })).toHaveCount(1)

  await expect(page.getByRole('heading', { name: /you've seen every game on this list/i })).toBeVisible()
  await expectAccessible(page)

  // right-swiped games are unmarked with their facts, left-swiped ones not interested
  await page.getByRole('link', { name: `Open ${name}` }).click()
  const unmarked = page.getByRole('region', { name: /not yet marked/i })
  await expect(unmarked.getByRole('button', { name: /kalypso/i })).toContainText('3-R400')
  await expect(unmarked.getByRole('button', { name: /harmonies/i })).toBeVisible()
  const skipped = page.getByRole('region', { name: /not interested/i })
  await skipped.getByRole('button', { name: /not interested/i }).click()
  for (const game of ['Cascadia', 'Arcs', 'Faraway']) await expect(skipped.getByRole('button', { name: game })).toBeVisible()

  // decided games are never offered again
  await mainButton(page).click()
  const again = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  await expect(again.getByRole('button', { name: /spiel essen 2026 preview/i })).toBeDisabled()
  await expect(again).toContainText("You've seen every game on it")
})
