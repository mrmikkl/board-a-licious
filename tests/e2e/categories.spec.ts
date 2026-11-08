import { expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, seedCollection, settled, unique } from './helpers.ts'

/**
 * F008 (docs/design.md "Category section", replacing F005's honeycomb): the game sheet of a shopping
 * list has a folded Category section after the info box; it shows the current category, unfolds into
 * the category sheet's list, and a tap sets the category, folds the section and toasts.
 */
test('details: the folded Category section after the info box; a tap sets the category, folds and toasts', async ({ page }) => {
  await fakeBgg(page)
  await seedCollection(page, unique('Categories'), [{ bggId: 295947, name: 'Cascadia', booth: '3-A101', mark: 'interested' }])

  await page.getByRole('button', { name: /^cascadia/i }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('group', { name: 'Category' })).toHaveCount(0)
  const section = dialog.getByRole('button', { name: /^Category/ })
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await expect(section).toHaveAccessibleName('Category Interested')
  // after the info box
  await settled(page)
  const facts = await dialog.locator('.facts-box').boundingBox()
  const box = await section.boundingBox()
  expect((box?.y ?? 0) + 1).toBeGreaterThanOrEqual((facts?.y ?? 0) + (facts?.height ?? 0))

  await section.click()
  const options = dialog.locator('.cat-list').getByRole('button')
  await expect(options).toHaveText([/must have/i, /interested/i, /unsure/i, /for later/i, /poop/i, /no category yet/i, /not interested/i])
  await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expectAccessible(page)

  await options.nth(3).click()
  await expect(page.locator('.toast')).toHaveText('Cascadia → ⏳ For later')
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await expect(section).toHaveAccessibleName('Category For later')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  // For later starts folded (FR-018a): its heading counts the game, unfolding shows it
  const laterGroup = page.getByRole('region', { name: /for later/i })
  await laterGroup.getByRole('button', { name: /^⏳ for later/i }).click()
  await expect(laterGroup.getByRole('button', { name: /^cascadia,/i })).toBeVisible()
  await expect(page.getByText(/\bmarks?\b/i)).toHaveCount(0)
})
