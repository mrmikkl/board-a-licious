import { expect, test } from '@playwright/test'

import { fakeBgg, unique } from './helpers.ts'

/**
 * SC-004 / FR-022: with no connection the app still opens (service worker), shows the collections
 * (IndexedDB) and takes marks and purchases; back online, the changes reach the server.
 * Runs against the production build (`vite preview`), where the service worker is active.
 */
test('offline: mark and buy in airplane mode, reload, then sync when back online', async ({ page, context }) => {
  await fakeBgg(page)
  await page.goto('/#/collections')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  const name = unique('Offline')
  await page.getByRole('link', { name: /add a collection, bgg list or game/i }).click()
  await page.getByRole('button', { name: /^collection/i }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await page.getByRole('link', { name: /add by link/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
  await page.getByRole('button', { name: `Add to ${name}` }).click()
  const game = () => page.getByRole('button', { name: /cascadia/i }).first()
  await expect(game()).toBeVisible()

  // airplane mode
  await context.setOffline(true)
  await game().click()
  await page.getByRole('dialog').getByRole('button', { name: /must have/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /bought it/i }).click()
  await page.getByRole('dialog').getByLabel('What did you pay?').fill('45')
  await page.getByRole('dialog').getByLabel('What did you pay?').press('Enter')
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toContainText('✅ €45')

  // a reload offline still opens the app with everything in place
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toContainText('✅ €45')

  // back online: the outbox is sent
  await context.setOffline(false)
  await expect
    .poll(
      async () => {
        const pulled = await (await page.request.get('/api/sync')).json()
        const collection = pulled.collections.find((c: { name: string }) => c.name === name)
        const entry = collection && pulled.entries.find((e: { collectionId: string; bggId: number }) => e.collectionId === collection.id && e.bggId === 295947)
        return entry ? [entry.mark, entry.bought, entry.paidCents] : null
      },
      { timeout: 15_000 },
    )
    .toEqual(['must_have', true, 4500])
})
