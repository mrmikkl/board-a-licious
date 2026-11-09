import { expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakeSearch, openMenu } from './helpers.ts'

/** Ids of their own per run (CLAUDE.md). */
const BASE = 2_100_000 + Math.floor(Math.random() * 1_000_000) * 100
const CASCADIA: FakeResult = { bggId: BASE + 1, name: 'Cascadia', year: 2021, kind: 'boardgame' }

test('the Search place finds a game on BGG and opens it to look at: shopping lists, players (BGG status with a username)', async ({ page }) => {
  await fakeSearch(page, { results: { cascad: [CASCADIA] } })
  await page.goto('/#/lists')
  await openMenu(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Search' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
  await expect(page).toHaveURL(/#\/search$/)
  // the field is the only control: no tabs, no action bar
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)
  const field = page.getByRole('searchbox', { name: 'Find a game' })
  await field.fill('cascad')
  await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`#/search\\?game=${CASCADIA.bggId}$`))

  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet.getByText('From BoardGameGeek', { exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add to shopping lists' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^Players/ })).toBeVisible()
  await expectAccessible(page)

  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/#\/search$/)
  await expect(field).toHaveValue('cascad')
  await openMenu(page)
  await expect(page.getByRole('navigation', { name: 'Menu' }).locator('[aria-current="page"]')).toHaveText('Search')
})
