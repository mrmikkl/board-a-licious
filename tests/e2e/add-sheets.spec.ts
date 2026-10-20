import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, mainButton, unique } from './helpers.ts'

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

async function fakePreview(page: Page) {
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: fixture(`preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    await route.fulfill({ json: { games: fixture('games-9093.json').games.filter((g: { bggId: number }) => ids.includes(g.bggId)) } })
  })
}

test('BG-Tinder and Add game open as sheets over the collection', async ({ page }) => {
  await fakePreview(page)
  const name = unique('Sheets')
  await createCollection(page, name)
  const title = page.getByRole('heading', { level: 1, name })

  // Add game: description, link, Cancel leaves the collection as it was
  await page.getByRole('button', { name: /^add game$/i }).click()
  const addGame = page.getByRole('dialog', { name: 'Add game' })
  await expect(addGame).toContainText('not on any of your lists')
  await expect(addGame.getByRole('button', { name: 'Add to collection' })).toBeDisabled()
  await expectAccessible(page)
  await addGame.getByRole('button', { name: 'Cancel' }).click()
  await expect(addGame).toHaveCount(0)
  await expect(title).toBeVisible()

  // ♥ BG-Tinder ↳ Add new list ↳ Load list goes to swiping that list
  await mainButton(page).click()
  const picker = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  await expect(title).toBeVisible()
  await picker.getByRole('button', { name: 'Add new list' }).click()
  const load = picker.getByRole('button', { name: 'Load list' })
  await expect(load).toBeDisabled()
  await picker.getByLabel(/bgg list link/i).fill('https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await load.click()
  await expect(page.getByRole('heading', { level: 1, name: `Add to ${name}` })).toBeVisible()

  // back on the collection the list is there to select: highlighted when chosen, then Select
  await page.goto(page.url().replace(/\/swipe\/.*$/, ''))
  await mainButton(page).click()
  await expect(picker.getByRole('button', { name: 'Select list' })).toHaveAttribute('aria-pressed', 'true')
  const select = picker.getByRole('button', { name: 'Select', exact: true })
  await expect(select).toBeDisabled()
  const list = picker.getByRole('button', { name: /spiel essen 2026 preview/i })
  await list.click()
  await expect(list).toHaveAttribute('aria-pressed', 'true')
  await expectAccessible(page)
  await select.click()
  await expect(page.getByRole('heading', { level: 1, name: `Add to ${name}` })).toBeVisible()
})
