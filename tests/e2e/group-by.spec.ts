import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, unique } from './helpers.ts'

const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

async function fakePreview(page: Page) {
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: apiFixture(`preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
  await page.route('**/api/bgg/games?**', route => route.fulfill({ json: { games: [] } }))
}

test('a collection grouped by booth shows the fair halls, and remembers the choice', async ({ page }) => {
  await fakePreview(page)
  const name = unique('Halls')
  await page.goto('/#/add/collection')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  // swipe three preview games in (they keep their booths in an Essen collection)
  await page.getByRole('link', { name: /^add by list$/i }).click()
  const picker = page.getByRole('dialog', { name: /add from which list/i })
  await picker.getByLabel(/bgg list link/i).fill('https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await picker.getByRole('button', { name: 'Load list' }).click()
  for (let i = 0; i < 3; i++) {
    await expect(page.getByRole('group', { name: /^game:/i })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(150)
  }
  await page.goto('/#/collections')
  await page.getByRole('link', { name: new RegExp(name) }).click()

  const groupBy = page.getByLabel('Group by')
  await expect(groupBy).toHaveValue('mark')
  await groupBy.selectOption('booth')
  await expect(page.getByRole('region', { name: /^hall \d+/i }).first()).toBeVisible()
  await expect(page.getByRole('region', { name: /not yet marked/i })).toHaveCount(0)
  await expectAccessible(page)

  await page.reload()
  await expect(page.getByLabel('Group by')).toHaveValue('booth')
  await expect(page.getByRole('region', { name: /^hall \d+/i }).first()).toBeVisible()
})
