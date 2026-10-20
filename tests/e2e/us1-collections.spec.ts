import { expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, mainButton, unique } from './helpers.ts'

test('US1: create a collection, add a game by link, mark it, reload', async ({ page }) => {
  await fakeBgg(page)
  await page.goto('/#/collections')
  const name = unique('Essen 2026')

  await page.goto('/#/collections?new')
  await page.getByLabel('Name').fill(name)
  await expect(page.getByRole('switch', { name: /essen collection/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create collection' }).click()

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(mainButton(page)).toHaveAccessibleName('BG-Tinder: swipe a BGG list into this collection')
  await expectAccessible(page)

  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await expect(page.getByLabel(/^name$/i)).toHaveValue('Cascadia')
  await page.getByRole('button', { name: 'Add to collection' }).click()

  const unmarked = page.getByRole('region', { name: /not yet marked/i })
  await expect(unmarked.getByRole('button', { name: /cascadia/i })).toBeVisible()

  await unmarked.getByRole('button', { name: /cascadia/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /must have/i }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toBeVisible()
  await expectAccessible(page)

  await page.reload()
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toBeVisible()
})
