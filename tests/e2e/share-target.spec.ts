import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

/** F002: sharing a BoardGameGeek page into the app (contracts/share-target.md). */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'
const shareUrl = (params: Record<string, string>) => `/share-target?${new URLSearchParams(params)}`

test('a share lands on #/shared once; Back and reload do not share again (T004)', async ({ page }) => {
  await page.goto('/#/collections')
  await page.goto(shareUrl({ text: `Cascadia ${CASCADIA}` }))
  await expect(page).toHaveURL(/\/#\/shared\?/)
  expect(new URL(page.url()).pathname).toBe('/')
  const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1])
  expect(params.get('text')).toBe(`Cascadia ${CASCADIA}`)
  // the entry URL is replaced, so it is not in the history
  await page.goBack()
  await expect(page).not.toHaveURL(/share-target/)
  // a reload stays on the same in-app route
  await page.goForward()
  await page.reload()
  await expect(page).toHaveURL(/\/#\/shared\?/)
})

const BLOG = 'https://boardgamegeek.com/blog/1/blogpost/171234/spiel-essen-2026-preview'

async function createCollection(page: Page, name: string): Promise<string> {
  await page.goto('/#/add/collection')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return decodeURIComponent(new URL(page.url()).hash.replace('#/collections/', ''))
}

/** Writes a meta value into this device's store (the share sheet sets lastShareCollection on add). */
async function setMeta(page: Page, key: string, value: unknown) {
  await page.evaluate(
    async ([key, value]) => {
      const name = (await indexedDB.databases()).find(d => d.name?.startsWith('board-a-licious-'))!.name!
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name)
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('meta', 'readwrite')
        tx.objectStore('meta').put(value, key as string)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    [key, value] as const,
  )
}

/** The name of the first live collection by name on this device. */
const firstCollectionName = (page: Page) =>
  page.evaluate(async () => {
    const name = (await indexedDB.databases()).find(d => d.name?.startsWith('board-a-licious-'))!.name!
    const db = await new Promise<IDBDatabase>(resolve => {
      const open = indexedDB.open(name)
      open.onsuccess = () => resolve(open.result)
    })
    const rows = await new Promise<{ name: string; deleted?: boolean }[]>(resolve => {
      const request = db.transaction('collections').objectStore('collections').getAll()
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    return rows.filter(r => !r.deleted).sort((a, b) => a.name.localeCompare(b.name))[0]!.name
  })

/** A person with no collections: the server's collections and entries are hidden from this device. */
async function noCollections(page: Page) {
  await page.route('**/api/sync**', async route => {
    if (route.request().method() !== 'GET') return route.continue()
    try {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...(await response.json()), collections: [], entries: [], lists: [] } })
    } catch {
      // the test ended while a sync was still on its way
    }
  })
}

test('a shared game opens over the collection shared into last (T009, T014)', async ({ page }) => {
  await fakeBgg(page)
  const other = await createCollection(page, unique('Other'))
  const last = unique('Shared last')
  const lastId = await createCollection(page, last)
  await page.goto(`/#/collections/${encodeURIComponent(other)}`)
  await setMeta(page, 'lastShareCollection', lastId)
  await page.goto(shareUrl({ text: `Cascadia ${CASCADIA}` }))
  await expect(page.getByRole('heading', { level: 1, name: last })).toBeVisible()
  await expect(page).toHaveURL(/\/#\/shared\?/)
  await expectAccessible(page)
})

test('a deleted or unknown last-shared collection falls back to the first collection by name (T014)', async ({ page }) => {
  await fakeBgg(page)
  await createCollection(page, unique('Any'))
  await setMeta(page, 'lastShareCollection', 'gone-collection-id')
  await page.goto(shareUrl({ url: CASCADIA }))
  await expect(page.getByRole('heading', { level: 1, name: await firstCollectionName(page) })).toBeVisible()
})

test('with no collection the shared game opens over the collections screen (T014)', async ({ page }) => {
  await fakeBgg(page)
  await noCollections(page)
  await page.goto(shareUrl({ url: CASCADIA }))
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
})

test('a shared page that is no game: "Not a BoardGameGeek game", Close goes to the collection behind (T009, T013)', async ({ page }) => {
  const name = unique('Behind')
  const id = await createCollection(page, name)
  await setMeta(page, 'lastShareCollection', id)
  await page.goto('/#/search')
  await page.goto(shareUrl({ text: `Read this ${BLOG}` }))
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  const sheet = page.getByRole('dialog', { name: 'Not a BoardGameGeek game' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('The shared page is not a game on boardgamegeek.com, so there is nothing to add.')).toBeVisible()
  await expect(sheet.getByText(BLOG)).toBeVisible()
  await expectAccessible(page)

  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`#/collections/${id}$`))
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  // the share was replaced in the history: Back does not reopen it
  await page.goBack()
  await expect(page).toHaveURL(/#\/search$/)
})

test('"Add game by link" opens Add game with an empty link (T013)', async ({ page }) => {
  const id = await createCollection(page, unique('Behind'))
  await setMeta(page, 'lastShareCollection', id)
  await page.goto(shareUrl({ url: 'https://example.com/not-bgg' }))
  const sheet = page.getByRole('dialog', { name: 'Not a BoardGameGeek game' })
  await expect(sheet.getByText('https://example.com/not-bgg')).toBeVisible()
  await sheet.getByRole('button', { name: 'Add game by link' }).click()
  await expect(page).toHaveURL(/#\/add\/game$/)
  await expect(page.getByLabel(/boardgamegeek link/i)).toHaveValue('')
  // Back from Add game goes to the collection, not to the share
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`#/collections/${id}$`))
})

test('with no collection, a shared page that is no game shows the sheet over the collections screen (T013)', async ({ page }) => {
  await noCollections(page)
  await page.goto(shareUrl({ text: 'just some words' }))
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  const sheet = page.getByRole('dialog', { name: 'Not a BoardGameGeek game' })
  await expect(sheet.getByText('just some words')).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/#\/collections$/)
})
