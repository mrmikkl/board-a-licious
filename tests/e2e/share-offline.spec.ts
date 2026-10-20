import { expect, test } from '@playwright/test'

import { createCollection, fakeBgg, unique } from './helpers.ts'

/**
 * F002 against the production build (`vite preview`), where the manifest and the service worker
 * exist: the app is a share target (contracts/share-target.md) and a share opens offline too.
 */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'

test('the manifest announces the app as a GET share target (T001)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.share_target).toEqual({ action: '/share-target', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } })
})

test('the manifest is fetched with credentials, so Chrome gets it through Cloudflare Access (T002)', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest" crossorigin="use-credentials"/)
})

test('the manifest and the page carry the PNG app icons (F003 T006)', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])
  const html = await (await request.get('/')).text()
  expect(html).toMatch(/<link rel="icon" href="\/icons\/favicon\.png"/)
  expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/)
  for (const src of [...manifest.icons.map((icon: { src: string }) => icon.src), '/icons/favicon.png', '/icons/apple-touch-icon.png']) {
    const response = await request.get(src)
    expect(response.ok(), src).toBe(true)
    expect(response.headers()['content-type'], src).toBe('image/png')
    // the PNG signature
    expect([...(await response.body()).subarray(0, 8)], src).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  }
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
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('offline share: framed note, added on the phone at once, synced once back online (T015)', async ({ page, context }) => {
  await fakeBgg(page)
  const name = unique('Shared Offline')
  await page.goto('/#/collections')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  // created once the service worker controls the page, so its first takeover cannot reload the sheet away
  await createCollection(page, name)

  // a game this device has never seen, so its details are still to come
  const bggId = 900_000 + Math.floor(Math.random() * 99_999)
  await context.setOffline(true)
  await page.goto(`/share-target?url=${encodeURIComponent(`https://boardgamegeek.com/boardgame/${bggId}/offline-fair-game`)}`)
  const sheet = page.getByRole('dialog', { name: 'Add game' })
  await expect(sheet).toContainText(
    'You are offline: the game is added on this phone now; its cover and details follow once you are back online.',
  )
  const select = sheet.getByLabel('Collection', { exact: true })
  await select.selectOption(await select.locator('option').filter({ hasText: name }).getAttribute('value'))
  await sheet.getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('button', { name: /offline fair game/i })).toContainText('Details follow from BoardGameGeek')

  await context.setOffline(false)
  await expect
    .poll(
      async () => {
        const pulled = await (await page.request.get('/api/sync')).json()
        const collection = pulled.collections.find((c: { name: string }) => c.name === name)
        return Boolean(collection && pulled.entries.some((e: { collectionId: string; bggId: number }) => e.collectionId === collection.id && e.bggId === bggId))
      },
      { timeout: 15_000 },
    )
    .toBe(true)
})

test('share while signed out (API 401): the game is added on the phone and "Sign in again" shows (T015)', async ({ page }) => {
  await fakeBgg(page)
  await page.addInitScript(() => localStorage.setItem('bal-last-email', 'you@example.com'))
  await page.route('**/api/**', route =>
    route.fulfill({ status: 401, json: { error: 'unauthenticated', message: 'Sign in to use the app.', retryable: false } }),
  )
  await page.goto(`/share-target?text=${encodeURIComponent(`Cascadia ${CASCADIA}`)}`)
  const sheet = page.getByRole('dialog', { name: 'Add game' })
  await expect(sheet).toBeVisible()
  // a fresh browser that cannot sync has no collection yet
  const created = unique('Shared Signed Out')
  await sheet.getByLabel('Collection name').fill(created)
  await sheet.getByRole('button', { name: 'Create and add' }).click()
  await expect(page.getByRole('heading', { level: 1, name: created })).toBeVisible()
  await expect(page.getByRole('button', { name: /cascadia/i })).toBeVisible()
  const banner = page.getByRole('status').filter({ hasText: /sign-in has expired/i })
  await expect(banner.getByRole('link', { name: 'Sign in again' })).toBeVisible()
})
