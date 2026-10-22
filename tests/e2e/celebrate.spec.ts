import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

async function createCollection(page: Page, name: string) {
  await page.goto('/#/collections')
  await page.goto('/#/collections?new')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function addByLink(page: Page, collection: string, link: string, game: string) {
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill(link)
  await expect(page.getByLabel(/^name$/i)).toHaveValue(game)
  await page.getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${game},`, 'i') })).toBeVisible()
}

const openGame = (page: Page, game: string) => page.getByRole('button', { name: new RegExp(`^${game}`, 'i') }).click()

test('celebrations: a burst for Must Have, a stamp for Bought, rolling counters; none with reduced motion', async ({ page }) => {
  await fakeBgg(page)
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const name = unique('Celebrate')
  await createCollection(page, name)
  await addByLink(page, name, 'https://boardgamegeek.com/boardgame/295947/cascadia', 'Cascadia')
  await addByLink(page, name, 'https://boardgamegeek.com/boardgame/342942/ark-nova', 'Ark Nova')
  const sheet = page.getByRole('dialog')
  const overlay = page.locator('.celebrate')
  const mustHaveCount = page.locator('#group-must_have')

  // Must Have: ~20 hexagons burst out of the tapped button, without blocking taps
  await openGame(page, 'Cascadia')
  const button = await sheet.getByRole('button', { name: /must have/i }).boundingBox()
  await sheet.getByRole('button', { name: /must have/i }).click()
  await expect(sheet).toBeHidden()
  await expect(mustHaveCount).toHaveAccessibleName(/Must Have 1/)
  if (reduced) {
    expect(await overlay.count()).toBe(0)
  } else {
    await expect(overlay.locator('.burst-hex')).toHaveCount(20)
    await expect(overlay).toHaveAttribute('aria-hidden', 'true')
    await expect(overlay).toHaveCSS('pointer-events', 'none')
    const burst = await overlay.locator('.burst').first().boundingBox()
    expect(Math.abs((burst?.x ?? 0) - ((button?.x ?? 0) + (button?.width ?? 0) / 2))).toBeLessThan(2)
    await expectAccessible(page)
  }
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)

  // a second Must Have: the count rolls from 1 to 2, the final value is in the name right away
  await openGame(page, 'Ark Nova')
  await sheet.getByRole('button', { name: /must have/i }).click()
  await expect(mustHaveCount).toHaveAccessibleName(/Must Have 2/)
  const rolling = await mustHaveCount.locator('.counter-roll').count()
  const flashing = await mustHaveCount.locator('.counter.flash').count()
  if (reduced) {
    expect(rolling).toBe(0)
    expect(flashing).toBe(0)
  } else {
    expect(rolling).toBe(1)
    expect(flashing).toBe(1)
    await expect(mustHaveCount.locator('.counter-roll')).toHaveCount(0)
  }
  await expect(mustHaveCount.locator('.group-count')).toHaveText('2')

  // Bought: "GOT IT!" in the centre plus a burst; the next tap goes through straight away
  await openGame(page, 'Ark Nova')
  await sheet.getByRole('button', { name: /bought it/i }).click()
  await sheet.getByLabel('What did you pay?').fill('45')
  await sheet.getByRole('button', { name: 'Got it' }).click()
  await expect(sheet).toBeHidden()
  if (reduced) {
    expect(await overlay.count()).toBe(0)
  } else {
    await expect(overlay.locator('.got-stamp')).toHaveText('GOT IT!')
    await expect(overlay.locator('.burst-hex')).toHaveCount(20)
  }
  await openGame(page, 'Cascadia')
  await expect(sheet).toBeVisible()
  await expect(page.getByText('✅ 1 game bought')).toBeAttached()
  await expect(overlay).toHaveCount(0)
})
