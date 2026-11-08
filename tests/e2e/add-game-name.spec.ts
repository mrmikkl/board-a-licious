import { expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakeSearch, seedCollection, unique } from './helpers.ts'

/** Ids of their own per run (CLAUDE.md: the dev user's data is shared between runs). */
const BASE = 3_000_000 + Math.floor(Math.random() * 1_000_000) * 100
const HARMONIES: FakeResult = { bggId: BASE + 1, name: 'Harmonies', year: 2024, kind: 'boardgame' }
const SPIRITS: FakeResult = { bggId: BASE + 2, name: 'Harmonies: Spirits', year: 2025, kind: 'expansion' }
const MANY = Array.from({ length: 12 }, (_, i): FakeResult => ({ bggId: BASE + 10 + i, name: `Sky Game ${i + 1}`, year: 2020, kind: 'boardgame' }))
const results = { harmon: [HARMONIES, SPIRITS], sky: MANY }

const field = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Add game' }).getByRole('searchbox', { name: 'Game name or BoardGameGeek link' })

async function openAddGame(page: import('@playwright/test').Page, games: { bggId: number; name: string }[] = []) {
  const name = unique('Essen 2026')
  await seedCollection(page, name, games)
  await page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: /^add game$/i }).click()
  return { name, sheet: page.getByRole('dialog', { name: 'Add game' }) }
}

test.describe('F006 US3: add a game by name in a collection', () => {
  test('a name lists matches; picking one adds it with the chosen category', async ({ page }) => {
    await fakeSearch(page, { results })
    const { name, sheet } = await openAddGame(page)
    await field(page).fill('harmon')
    const matches = sheet.getByRole('list', { name: 'Matching games' })
    await expect(matches.getByRole('button', { name: 'Harmonies, 2024' })).toBeVisible()
    await expect(matches.getByRole('button', { name: 'Harmonies: Spirits, 2025, expansion' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: /to a collection$/ })).toHaveCount(0)
    await expectAccessible(page)

    await matches.getByRole('button', { name: 'Harmonies, 2024' }).click()
    await expect(sheet.getByRole('heading', { name: `Found game ID ${HARMONIES.bggId}` })).toBeVisible()
    await expect(sheet.getByLabel(/^name$/i)).toHaveValue('Harmonies')
    await expect(sheet.getByRole('button', { name: 'Change' })).toBeVisible()
    // F008 feedback: the category is a folded section, no hexagon picker
    await sheet.getByRole('button', { name: /^Category/ }).click()
    await sheet.getByRole('button', { name: /Interested/ }).click()
    await expect(sheet.getByRole('button', { name: /^Category/ })).toHaveAttribute('aria-expanded', 'false')
    await expect(sheet.getByRole('button', { name: /^Category/ })).toContainText('Interested')
    await sheet.getByRole('button', { name: 'Add to shopping list' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: `Added Harmonies to ${name}` })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Harmonies, Interested/ })).toBeVisible()
  })

  test('at most 8 matches; Change goes back to the field', async ({ page }) => {
    await fakeSearch(page, { results })
    const { sheet } = await openAddGame(page)
    await field(page).fill('sky')
    const matches = sheet.getByRole('list', { name: 'Matching games' })
    await expect(matches.getByRole('button')).toHaveCount(8)
    await matches.getByRole('button').first().click()
    await sheet.getByRole('button', { name: 'Change' }).click()
    await expect(field(page)).toBeVisible()
  })

  test('a game already in the collection cannot be added again', async ({ page }) => {
    await fakeSearch(page, { results })
    const { name, sheet } = await openAddGame(page, [{ bggId: HARMONIES.bggId, name: 'Harmonies' }])
    await field(page).fill('harmon')
    await sheet.getByRole('list', { name: 'Matching games' }).getByRole('button', { name: 'Harmonies, 2024' }).click()
    await expect(sheet.getByText(`This game is already in ${name}.`)).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Add to shopping list' })).toBeDisabled()
  })

  test('a pasted link works as before', async ({ page }) => {
    await fakeSearch(page, { results })
    const { sheet } = await openAddGame(page)
    await field(page).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
    await expect(sheet.getByRole('heading', { name: 'Found game ID 295947' })).toBeVisible()
    await expect(sheet.getByLabel(/^name$/i)).toHaveValue('Cascadia')
    await expect(sheet.getByRole('button', { name: 'Add to shopping list' })).toBeEnabled()
  })

  test('without the token a name asks for the link', async ({ page }) => {
    await fakeSearch(page, { token: false })
    const { sheet } = await openAddGame(page)
    await field(page).fill('harmon')
    await expect(sheet.getByText("Searching by name needs BoardGameGeek access; paste the game's link instead.")).toBeVisible()
  })
})
