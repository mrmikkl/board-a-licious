import { expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

/** F002: the Share hint in Config (FR-011, research R6) and the just-added row (docs/design.md Motion). */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'

test('Config in a browser tab shows the Share hint at the top (T019)', async ({ page }) => {
  await page.goto('/#/config')
  const hint = page.getByRole('region', { name: /share from boardgamegeek/i })
  await expect(hint).toBeVisible()
  await expect(hint).toContainText(/home screen/i)
  await expect(hint).toContainText(/BGG app or website/i)
  await expect(hint).toContainText(/⋮ → Add to Home screen/)
  await expect(hint).toContainText(/open board-a-licious from its icon/i)
  // at the top: before the first section heading of Config
  const first = page.locator('main h2').first()
  await expect(first).toHaveText(/share from boardgamegeek/i)
  await expectAccessible(page)
})

test('Config in the installed app (standalone) has no Share hint (T019)', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      const list = original(query)
      // as when opened from the home-screen icon
      if (query.includes('display-mode: standalone')) Object.defineProperty(list, 'matches', { value: true })
      return list
    }
  })
  await page.goto('/#/config')
  await expect(page.getByRole('heading', { name: 'Sound' })).toBeVisible()
  await expect(page.getByRole('region', { name: /share from boardgamegeek/i })).toHaveCount(0)
})

// Enabled by the coordinator after the merge: the share sheet (worker A, T011) calls markJustAdded.
test('the game just added from a share keeps the hover highlight until the user scrolls or taps (T010)', async ({ page }) => {
  await fakeBgg(page)
  await page.goto('/#/collections')
  const name = unique('Essen 2026')
  await page.goto('/#/collections?new')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  await page.goto(`/share-target?${new URLSearchParams({ text: `Cascadia ${CASCADIA}` })}`)
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Collection').selectOption({ label: name })
  await sheet.getByRole('button', { name: 'Add to collection' }).click()

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const row = page.getByRole('region', { name: /not yet marked/i }).getByRole('button', { name: /cascadia/i })
  // shown with reduced motion too: it is a highlight, not an animation
  await expect(row).toHaveClass(/is-just-added/)
  await expect(row).toHaveCSS('border-color', 'rgb(255, 122, 26)')
  await expectAccessible(page)

  // a tap elsewhere (here: on the screen title) ends it
  await page.getByRole('heading', { level: 1, name }).click()
  await expect(row).not.toHaveClass(/is-just-added/)
})
