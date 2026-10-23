import { expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, seedCollection, unique } from './helpers.ts'

type Box = { x: number; y: number; width: number; height: number }

/**
 * F005 US3 (FR-001, FR-010, FR-011; research R9): the details show the category as a honeycomb
 * above the info box; a tap changes the category in place, and "Category" is the only word for it.
 */
test('details: category picker as a honeycomb above the info box, a tap changes it in place', async ({ page }) => {
  await fakeBgg(page)
  await seedCollection(page, unique('Categories'), [{ bggId: 295947, name: 'Cascadia', booth: '3-A101', mark: 'interested' }])

  await page.getByRole('button', { name: /^cascadia/i }).first().click()
  const dialog = page.getByRole('dialog')
  const picker = dialog.getByRole('group', { name: 'Category' })
  const buttons = picker.getByRole('button')
  await expect(buttons).toHaveText([/must have/i, /interested/i, /unsure/i, /for later/i, /poop/i])
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true')

  // honeycomb: Must Have, Unsure, Poop on top; Interested and For later below, each 44–88px wide
  const boxes = await Promise.all(
    [0, 1, 2, 3, 4].map(async i => {
      const box = await buttons.nth(i).boundingBox()
      if (!box) throw new Error(`category ${i} has no box`)
      return box
    }),
  )
  const [mustHave, interested, unsure, later, poop] = boxes as [Box, Box, Box, Box, Box]
  for (const b of [mustHave, interested, unsure, later, poop]) {
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(b.width).toBeLessThanOrEqual(88)
  }
  expect(mustHave.y).toBeLessThan(interested.y)
  expect(unsure.y).toBeLessThan(later.y)
  expect(poop.y).toBeLessThan(later.y)
  expect(interested.x).toBeGreaterThan(mustHave.x)
  expect(interested.x).toBeLessThan(unsure.x)
  expect(later.x).toBeGreaterThan(interested.x)
  // above the info box
  const facts = await dialog.locator('.facts-box').boundingBox()
  expect(later.y + later.height).toBeLessThanOrEqual((facts?.y ?? 0) + 1)

  await expect(dialog.getByRole('button', { name: '🛑 Not interested' })).toBeVisible()
  await expectAccessible(page)

  // a tap changes the category in place: the sheet stays open and shows the new choice
  await buttons.nth(3).click()
  await expect(buttons.nth(3)).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  // For later starts folded (FR-018a): its heading counts the game, unfolding shows it
  const laterGroup = page.getByRole('region', { name: /for later/i })
  await laterGroup.getByRole('button', { name: /^⏳ for later/i }).click()
  await expect(laterGroup.getByRole('button', { name: /^cascadia,/i })).toBeVisible()
  await expect(page.getByText(/\bmarks?\b/i)).toHaveCount(0)
})
