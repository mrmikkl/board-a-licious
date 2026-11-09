import { expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakeSearch } from './helpers.ts'

/** Ids of their own per run (CLAUDE.md). */
const BASE = 2_100_000 + Math.floor(Math.random() * 1_000_000) * 100
const CASCADIA: FakeResult = { bggId: BASE + 1, name: 'Cascadia', year: 2021, kind: 'boardgame' }
const results = { cascad: [CASCADIA] }

test('Lists › Search finds a game on BGG and opens it to look at: shopping lists and players (BGG status with a username, as everywhere)', async ({ page }) => {
  await fakeSearch(page, { results })
  await page.goto('/#/lists')
  await page.getByRole('tab', { name: 'Search' }).click()
  await expect(page).toHaveURL(/#\/lists\/search$/)
  const field = page.getByRole('searchbox', { name: 'Find a game' })
  await expect(field).toBeEnabled()
  // the field is the only control: no Load list here
  await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)
  await field.fill('cascad')
  await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/lists/search\\?game=${CASCADIA.bggId}$`))

  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet.getByText('From BoardGameGeek')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add to shopping lists' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^Players/ })).toBeVisible()
  await expectAccessible(page)

  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/#\/lists\/search$/)
  await expect(field).toHaveValue('cascad')

  // the menu opens Lists on the last tab
  await page.goto('/#/config')
  await page.goto('/#/lists')
  await expect(page.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true')
})
