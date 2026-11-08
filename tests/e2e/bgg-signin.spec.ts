import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBggAccount, fakeBggCollection, fakeNoGameDetails, keepBggSettingsLocal, setBggUsername } from './helpers.ts'

/** F008 US3 (spec.md, docs/design.md "Sign in to BoardGameGeek"): sign in to BGG on this device. */
const PASSWORD = 'pa55-not-kept'

async function config(page: Page, options: Parameters<typeof fakeBggAccount>[1] = {}) {
  await keepBggSettingsLocal(page)
  await fakeNoGameDetails(page)
  await fakeBggCollection(page, { mrmikkl: [] })
  await fakeBggAccount(page, options)
  await setBggUsername(page, 'mrmikkl')
}

/** Every value in localStorage and in every IndexedDB database of the page, as one text. */
const deviceStorage = (page: Page) =>
  page.evaluate(async () => {
    const parts: string[] = [JSON.stringify({ ...localStorage })]
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name)
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      for (const store of db.objectStoreNames) {
        const all = await new Promise<unknown[]>(resolve => {
          const request = db.transaction(store).objectStore(store).getAll()
          request.onsuccess = () => resolve(request.result)
        })
        parts.push(JSON.stringify(all))
      }
      db.close()
    }
    return parts.join('\n')
  })

test('Config explains signing in and offers Sign in to BoardGameGeek', async ({ page }) => {
  await config(page)
  await expect(page.getByRole('heading', { name: 'Change statuses on BGG' })).toBeVisible()
  await expect(page.getByText('Sign in to change statuses and add what you paid on BoardGameGeek.')).toBeVisible()
  await expect(page.getByText(/does not keep it\. The sign-in stays on this device only/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to BoardGameGeek' })).toBeVisible()
  await expectAccessible(page)
})

test('the sign-in sheet: hint, fields, the error for a wrong password, Cancel', async ({ page }) => {
  await config(page)
  await page.getByRole('button', { name: 'Sign in to BoardGameGeek' }).click()
  const sheet = page.getByRole('dialog', { name: 'Sign in to BoardGameGeek' })
  await expect(sheet.getByText('Your password is used once to sign in and is not kept. The sign-in stays on this device.')).toBeVisible()
  await expect(sheet.getByLabel('BGG username')).toHaveValue('mrmikkl')
  await expect(sheet.getByLabel('Password')).toHaveAttribute('type', 'password')
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expectAccessible(page)

  await sheet.getByLabel('Password').fill('wrong')
  await sheet.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(sheet.getByText('BoardGameGeek did not accept this username or password.')).toBeVisible()
  await expectAccessible(page)

  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign in to BoardGameGeek' })).toBeVisible()
})

test('signing in shows the signed-in line, keeps no password on the device; Sign out', async ({ page }) => {
  await config(page)
  await page.getByRole('button', { name: 'Sign in to BoardGameGeek' }).click()
  const sheet = page.getByRole('dialog', { name: 'Sign in to BoardGameGeek' })
  await sheet.getByLabel('Password').fill(PASSWORD)
  await sheet.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Signed in to BoardGameGeek as mrmikkl' })).toBeVisible()
  await expect(page.getByText('Signed in to BoardGameGeek as mrmikkl on this device')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out of BoardGameGeek' })).toBeVisible()
  await expectAccessible(page)

  const stored = await deviceStorage(page)
  expect(stored).not.toContain(PASSWORD)
  expect(stored).not.toContain('bal_bgg')

  await page.getByRole('button', { name: 'Sign out of BoardGameGeek' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Signed out of BoardGameGeek on this device' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to BoardGameGeek' })).toBeVisible()
})

test('the signed-in line follows the server after a reload', async ({ page }) => {
  await config(page, { signedIn: true })
  await expect(page.getByText('Signed in to BoardGameGeek as mrmikkl on this device')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Signed in to BoardGameGeek as mrmikkl on this device')).toBeVisible()
})
