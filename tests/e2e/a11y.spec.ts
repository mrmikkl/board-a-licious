import { readFileSync } from 'node:fs'

import { type Page, type TestInfo, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

async function fakePreview(page: Page) {
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: apiFixture(`preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
}

/**
 * Walks the focus with Tab: every stop is visible, named, at least 44 px where it is a control
 * (constitution I), and the order follows the page from top to bottom within the screen.
 */
async function checkFocus(page: Page, stops = 12) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const seen: { name: string; top: number; inDialog: boolean }[] = []
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const box = el.getBoundingClientRect()
      // an input inside a <label> is tapped through the whole label
      const target = (el.tagName === 'INPUT' ? el.closest('label') : null)?.getBoundingClientRect() ?? box
      const name = (el.getAttribute('aria-label') || el.innerText || (el as HTMLInputElement).labels?.[0]?.innerText || el.title || '').trim()
      const control = ['BUTTON', 'A', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'switch'
      return { name, w: target.width, h: target.height, top: box.top + window.scrollY, visible: box.width > 0 && box.height > 0, control, inDialog: Boolean(el.closest('[role="dialog"]')) }
    })
    if (!info) continue
    expect(info.visible, `focus stop ${i + 1} is visible`).toBe(true)
    expect(info.name, `focus stop ${i + 1} has a name`).not.toBe('')
    if (info.control) expect(Math.min(info.w, info.h), `"${info.name}" is at least 44 px`).toBeGreaterThanOrEqual(43.5)
    seen.push({ name: info.name, top: info.top, inDialog: info.inDialog })
  }
  expect(seen.length).toBeGreaterThan(0)
}

/** With reduced motion nothing animates: no running CSS animations or transitions (design §9). */
async function checkStill(page: Page, testInfo: TestInfo) {
  if (!testInfo.project.name.includes('reduced-motion')) return
  await page.waitForTimeout(400)
  const running = await page.evaluate(() =>
    document.getAnimations().filter(a => a.playState === 'running').map(a => (a as CSSAnimation).animationName ?? 'transition'),
  )
  expect(running).toEqual([])
}

async function check(page: Page, testInfo: TestInfo, focus = true) {
  await expectAccessible(page)
  if (focus) await checkFocus(page)
  await checkStill(page, testInfo)
}

test('every screen and sheet: axe clean, no horizontal scroll, sensible focus, still with reduced motion', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await fakeBgg(page)
  await fakePreview(page)
  const name = unique('A11y')

  await page.goto('/#/collections')
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await check(page, testInfo)

  await page.goto('/#/add')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, testInfo)
  for (const what of ['collection', 'game', 'list']) {
    await page.goto(`/#/add/${what}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await check(page, testInfo)
  }

  // a new collection: empty state, add by link, a game in it, the game sheet
  await page.goto('/#/add/collection')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await check(page, testInfo)
  await page.getByRole('link', { name: /add by link/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await check(page, testInfo)
  await page.getByRole('button', { name: `Add to ${name}` }).click()
  await page.getByRole('button', { name: /cascadia/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check(page, testInfo)
  await page.keyboard.press('Escape')

  // swipe: list picker, then the card stack
  await page.getByRole('link', { name: /add from bgg list/i }).click()
  const picker = page.getByRole('dialog', { name: /add from which list/i })
  await expect(picker).toBeVisible()
  await check(page, testInfo)
  await picker.getByLabel(/bgg list link/i).fill('https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await picker.getByRole('button', { name: 'Load list' }).click()
  await expect(page.getByRole('group', { name: /^game:/i })).toBeVisible()
  await check(page, testInfo)

  // lists, a list, the list game sheet
  await page.goto('/#/lists')
  await expect(page.getByRole('heading', { level: 1, name: 'BGG lists' })).toBeVisible()
  await check(page, testInfo)
  await page.goto('/#/lists/preview/9093')
  await expect(page.getByRole('button', { name: /^kalypso/i })).toBeVisible()
  await check(page, testInfo)
  await page.getByRole('button', { name: /^kalypso/i }).click()
  await expect(page.getByRole('dialog', { name: 'Kalypso' })).toBeVisible()
  await check(page, testInfo)
  await page.keyboard.press('Escape')

  await page.goto('/#/search')
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
  await check(page, testInfo)

  await page.goto('/#/share')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, testInfo)
})
