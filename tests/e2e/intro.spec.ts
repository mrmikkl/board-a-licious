import { type Locator, type Page, expect, test } from '@playwright/test'

import { expectAccessible } from './helpers.ts'

// a fresh device: every other test starts on one that has seen the intro (playwright.config.ts)
test.use({ storageState: { cookies: [], origins: [] } })

const introOf = (page: Page) => page.getByRole('region', { name: 'Introduction' })

async function drag(page: Page, target: Locator, dx: number) {
  const box = await target.boundingBox()
  if (!box) throw new Error('nothing to drag')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  await page.mouse.up()
}

test('intro: shown on first start, Skip lands on Collections, not shown again until asked for', async ({ page }) => {
  await page.goto('/')
  const intro = introOf(page)
  await expect(intro.getByRole('group', { name: '1 of 3' })).toBeVisible()
  await expect(intro.getByRole('heading', { name: 'Collections' })).toBeVisible()
  await expectAccessible(page)

  await intro.getByRole('button', { name: 'Skip' }).click()
  await expect(intro).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await expect(intro).toBeHidden()

  // the intro can be shown again from Config
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Config' }).click()
  await page.getByRole('button', { name: 'Show the intro again' }).click()
  await expect(intro.getByRole('group', { name: '1 of 3' })).toBeVisible()
  await intro.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
})

test('intro: keyboard, buttons and swipe move through the cards', async ({ page }) => {
  await page.goto('/')
  const intro = introOf(page)
  const next = intro.getByRole('button', { name: 'Next' })
  await expect(next).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(intro.getByRole('group', { name: '2 of 3' })).toBeVisible()
  await expect(intro.getByRole('heading', { name: 'BGG lists' })).toBeVisible()

  // swipe left goes on, swipe right goes back, arrow keys do the same
  await drag(page, intro.getByRole('group', { name: '2 of 3' }), -160)
  await expect(intro.getByRole('group', { name: '3 of 3' })).toBeVisible()
  await expect(intro.getByRole('heading', { name: 'Swipe, then hunt' })).toBeVisible()
  await drag(page, intro.getByRole('group', { name: '3 of 3' }), 160)
  await expect(intro.getByRole('group', { name: '2 of 3' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(intro.getByRole('group', { name: '3 of 3' })).toBeVisible()
  await expectAccessible(page)

  // on the last card Next becomes "Let's go", still with the focus
  const go = intro.getByRole('button', { name: "Let's go" })
  await expect(go).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(intro).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
})

test('intro: the floating hexagons stand still with reduced motion', async ({ page }) => {
  await page.goto('/')
  const hexagon = introOf(page).locator('.intro-art .hex').first()
  await expect(hexagon).toBeVisible()
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  await expect(hexagon).toHaveCSS('animation-name', reduced ? 'none' : 'intro-float')
})

test('intro: never blocks when the device keeps no storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked')
      },
    })
  })
  await page.goto('/')
  const intro = introOf(page)
  await intro.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await expect(intro).toBeHidden()
})
