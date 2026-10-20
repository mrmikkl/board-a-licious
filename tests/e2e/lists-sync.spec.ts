import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { createCollection, loadList, mainButton } from './helpers.ts'

const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

async function fakePreview(page: Page) {
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: apiFixture(`preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
}

/** A list loaded on one device shows up on the person's other device and loads its games there. */
test('a BGG list loaded on the phone appears on the laptop', async ({ browser }) => {
  const phone = await browser.newPage()
  await fakePreview(phone)
  await loadList(phone, 'https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await expect(phone.getByRole('button', { name: /^kalypso/i })).toBeVisible()
  // the list reference reaches the server with the next sync
  await expect
    .poll(async () => ((await (await phone.request.get('/api/sync')).json()).lists as { id: number }[]).some(l => l.id === 9093), { timeout: 10_000 })
    .toBe(true)

  // another device: a fresh browser context has its own IndexedDB
  const laptopContext = await browser.newContext({ storageState: test.info().project.use.storageState })
  const laptop = await laptopContext.newPage()
  await fakePreview(laptop)
  await laptop.goto('/#/lists')
  const card = laptop.locator('a[href="#/lists/preview/9093"]')
  await expect(card).toBeVisible({ timeout: 10_000 })
  await expect(card).toContainText(/loaded on another device/i)

  // a new collection can swipe it right away: not "seen every game", it loads when selected
  await createCollection(laptop, `Laptop ${Date.now()}`)
  await mainButton(laptop).click()
  const picker = laptop.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
  const pick = picker.locator('.pick', { hasText: 'SPIEL Essen 2026 Preview' })
  await expect(pick).toBeEnabled()
  await expect(pick).toContainText('Its games load when you select it.')
  await pick.click()
  await picker.getByRole('button', { name: 'Select', exact: true }).click()
  await expect(laptop.getByRole('group', { name: /^game:/i })).toBeVisible()

  await laptop.goto('/#/lists')
  await card.click()
  await expect(laptop.getByRole('button', { name: /^kalypso/i })).toBeVisible()
  await laptopContext.close()
})
