import { expect, test } from '@playwright/test'

/**
 * An expired Cloudflare Access session: the app still opens from the device (service worker and
 * IndexedDB) but says the sign-in expired and offers a way back to the PIN login, instead of
 * pretending to be offline.
 */
test('expired sign-in with a known person: the app opens and offers to sign in again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bal-last-email', 'you@example.com'))
  await page.route('**/api/**', route =>
    route.fulfill({ status: 401, json: { error: 'unauthenticated', message: 'Sign in to use the app.', retryable: false } }),
  )
  await page.goto('/#/collections')
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  const banner = page.getByRole('status').filter({ hasText: /sign-in has expired/i })
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/api/signin')
})

test('expired sign-in on a new device: a sign-in button instead of the app', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('bal-last-email'))
  await page.route('**/api/**', route =>
    route.fulfill({ status: 401, json: { error: 'unauthenticated', message: 'Sign in to use the app.', retryable: false } }),
  )
  await page.goto('/#/collections')
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/api/signin')
})
