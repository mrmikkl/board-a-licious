import { expect, test } from '@playwright/test'

/**
 * F002 against the production build (`vite preview`), where the manifest and the service worker
 * exist: the app is a share target (contracts/share-target.md) and a share opens offline too.
 */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'

test('the manifest announces the app as a GET share target (T001)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.share_target).toEqual({ action: '/share-target', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } })
})

test('a share opens the app on #/shared, also offline (T004)', async ({ page, context }) => {
  await page.goto('/#/collections')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  await page.goto(`/share-target?text=${encodeURIComponent(`Cascadia ${CASCADIA}`)}`)
  await expect(page).toHaveURL(/\/#\/shared\?/)
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await context.setOffline(false)
})
