import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { type Place, fakeBgg, goTo, mainButton, openMenu, unique } from './helpers.ts'

/** F003 navigation (contracts/navigation.md): the app bar and its menu replace the tab bar. */
const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

async function fakePreview(page: Page) {
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: apiFixture(`preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menu' })
const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true })

/** A collection to visit; created through the New collection sheet's route. */
async function newCollection(page: Page) {
  const name = unique('Nav')
  await page.goto('/#/collections?new')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  return { name, hash: new URL(page.url()).hash }
}

async function expectAppBar(page: Page) {
  const bar = page.locator('.appbar')
  await expect(bar.locator('img[src="/icons/logo.png"]')).toHaveAttribute('alt', '')
  await expect(bar).toContainText('Board-a-licious')
  await expect(menuButton(page)).toBeVisible()
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
}

async function expectCurrent(page: Page, place: Place) {
  await openMenu(page)
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true')
  const links = menu(page).getByRole('link')
  await expect(links).toHaveText(['Collections', 'BGG lists', 'Search', 'Config'])
  await expect(menu(page).locator('[aria-current="page"]')).toHaveText(place)
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
}

test('US1: every screen has the app bar, the menu marks the current place, back only where it belongs', async ({ page }) => {
  test.setTimeout(60_000)
  await fakeBgg(page)
  await fakePreview(page)
  const collection = await newCollection(page)
  const back = page.getByRole('link', { name: 'Back', exact: true })

  const screens: { hash: string; heading: string | RegExp; place: Place; back?: string }[] = [
    { hash: '#/collections', heading: 'Collections', place: 'Collections' },
    { hash: collection.hash, heading: collection.name, place: 'Collections' },
    { hash: '#/lists', heading: 'BGG lists', place: 'BGG lists' },
    { hash: '#/lists/preview/9093', heading: /spiel/i, place: 'BGG lists', back: '#/lists' },
    { hash: `${collection.hash}/swipe/preview/9093`, heading: `Add to ${collection.name}`, place: 'Collections', back: collection.hash },
    { hash: '#/search', heading: 'Search', place: 'Search' },
    { hash: '#/config', heading: 'Config', place: 'Config' },
    { hash: '#/config/share', heading: 'Share and backup', place: 'Config', back: '#/config' },
  ]
  for (const screen of screens) {
    await page.goto(`/${screen.hash}`)
    await expect(page.getByRole('heading', { level: 1, name: screen.heading })).toBeVisible()
    await expectAppBar(page)
    if (screen.back) await expect(back).toHaveAttribute('href', screen.back)
    else await expect(back, `no back button on ${screen.hash}`).toHaveCount(0)
    await expectCurrent(page, screen.place)
  }
})

test('US1: choosing a place goes there and closes the menu; Esc and the scrim close it without navigating', async ({ page }) => {
  await page.goto('/#/collections')
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()

  // focus moves into the menu, onto the current place
  await openMenu(page)
  await expect(menu(page).getByRole('link', { name: 'Collections' })).toBeFocused()
  await menu(page).getByRole('link', { name: 'BGG lists' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'BGG lists' })).toBeVisible()
  await expect(menu(page)).toHaveCount(0)
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false')

  await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(menuButton(page)).toBeFocused()
  await expect(page).toHaveURL(/#\/lists$/)

  await openMenu(page)
  await page.locator('.menu-scrim').click({ position: { x: 20, y: 600 } })
  await expect(menu(page)).toHaveCount(0)
  await expect(menuButton(page)).toBeFocused()
  await expect(page).toHaveURL(/#\/lists$/)

  // ☰ toggles
  await openMenu(page)
  await menuButton(page).click()
  await expect(menu(page)).toHaveCount(0)

  // a route change closes it too (browser Back)
  await openMenu(page)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await expect(menu(page)).toHaveCount(0)
})

test('US1: every place is two taps away (SC-001)', async ({ page }) => {
  await page.goto('/#/config/share')
  for (const place of ['Collections', 'BGG lists', 'Search', 'Config', 'Collections'] as const) await goTo(page, place)
})

test.describe('US2', () => {
  const actions = (page: Page) => page.getByRole('navigation', { name: 'Actions' })
  const PREVIEW = 'https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview'

  test('Collections: main ＋ opens New collection; Cancel and Back close it; Create collection opens the new one', async ({ page }) => {
    await page.goto('/#/collections')
    await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
    await expect(mainButton(page)).toHaveAccessibleName('Create a collection')
    // no "Create a collection" card on the screen: the main button is the one way in
    await expect(page.locator('main').getByText('Create a collection')).toHaveCount(0)

    const sheet = page.getByRole('dialog', { name: 'New collection' })
    await mainButton(page).click()
    await expect(sheet).toBeVisible()
    await expect(page).toHaveURL(/#\/collections\?new$/)
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/#\/collections$/)

    // Back from the open sheet closes it
    await mainButton(page).click()
    await expect(sheet).toBeVisible()
    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()

    await mainButton(page).click()
    const name = unique('Main')
    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Create collection' }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(page).toHaveURL(/#\/collections\/[^?]+$/)
  })

  test('a collection: main ♥ opens ❤️ BG-Tinder ❤️, which loads a new list or selects a loaded one for Swipe', async ({ page }) => {
    await fakeBgg(page)
    await fakePreview(page)
    const collection = await newCollection(page)
    await expect(mainButton(page)).toHaveAccessibleName('BG-Tinder: swipe a BGG list into this collection')
    // no "Add by list" buttons any more (tool row, empty state)
    await expect(page.getByRole('button', { name: /add by list/i })).toHaveCount(0)

    const tinder = page.getByRole('dialog', { name: '❤️ BG-Tinder ❤️' })
    await mainButton(page).click()
    await expect(tinder).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${collection.hash}\\?add=list$`))
    await tinder.getByRole('button', { name: 'Cancel' }).click()
    await expect(tinder).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`${collection.hash}$`))

    // a list not loaded yet: Add new list ↳ Load list
    await mainButton(page).click()
    await tinder.getByRole('button', { name: 'Add new list' }).click()
    await tinder.getByLabel(/bgg list link/i).fill(PREVIEW)
    await tinder.getByRole('button', { name: 'Load list' }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Add to ${collection.name}` })).toBeVisible()

    // a loaded list: Select ↳ Swipe
    await page.goto(`/${collection.hash}`)
    await mainButton(page).click()
    await tinder.getByRole('button', { name: /spiel essen 2026 preview/i }).click()
    await tinder.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Add to ${collection.name}` })).toBeVisible()
  })

  test('BGG lists: main ＋ opens Load a BGG list; a wrong link shows the hint, a valid one opens the list', async ({ page }) => {
    await fakeBgg(page)
    await fakePreview(page)
    await page.goto('/#/lists')
    await expect(page.getByRole('heading', { level: 1, name: 'BGG lists' })).toBeVisible()
    await expect(mainButton(page)).toHaveAccessibleName('Load a BGG list')
    await expect(page.locator('main').getByText('Load a BGG list')).toHaveCount(0)

    await mainButton(page).click()
    const sheet = page.getByRole('dialog', { name: 'Load a BGG list' })
    await expect(page).toHaveURL(/#\/lists\?load$/)
    const link = sheet.getByLabel(/link/i)
    const load = sheet.getByRole('button', { name: 'Load list' })
    await expect(load).toBeDisabled()
    await link.fill('https://example.com/nothing')
    await expect(sheet.getByText(/paste a link to a boardgamegeek preview or geeklist/i)).toBeVisible()
    await expect(load).toBeDisabled()
    await link.fill(PREVIEW)
    await expect(sheet.getByText(/preview: games with booth/i)).toBeVisible()
    await load.click()
    await expect(page).toHaveURL(/#\/lists\/preview\/9093$/)
    await expect(page.getByRole('heading', { level: 1, name: /spiel/i })).toBeVisible()
  })

  test('Search has the disabled main 🔍; Config, a list, Swipe and Share and backup have no action bar', async ({ page }) => {
    await fakeBgg(page)
    await fakePreview(page)
    await page.goto('/#/search')
    await expect(mainButton(page)).toHaveAccessibleName('Search (not available yet)')
    await expect(mainButton(page)).toBeDisabled()
    await expect(page.locator('main').getByRole('link', { name: /add a game/i })).toHaveCount(0)

    const collection = await newCollection(page)
    for (const [hash, heading] of [
      ['#/config', 'Config'],
      ['#/config/share', 'Share and backup'],
      ['#/lists/preview/9093', /spiel/i],
      [`${collection.hash}/swipe/preview/9093`, `Add to ${collection.name}`],
    ] as const) {
      await page.goto(`/${hash}`)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(actions(page), `no action bar on ${hash}`).toHaveCount(0)
    }
  })

  test('old add addresses and links open the matching sheet', async ({ page }) => {
    await page.goto('/#/add/list')
    await expect(page.getByRole('heading', { level: 1, name: 'BGG lists' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Load a BGG list' })).toBeVisible()

    await page.goto('/#/add')
    await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.goto('/#/add/collection')
    await expect(page.getByRole('dialog', { name: 'New collection' })).toBeVisible()

    // a list that does not exist offers loading another one through the sheet
    await page.route('**/api/bgg/lists/preview/9094?**', route =>
      route.fulfill({ status: 404, json: { error: 'not_found', message: 'This list does not exist.', retryable: false } }),
    )
    await page.goto('/#/lists/preview/9094')
    await page.locator('main').getByRole('link', { name: 'Load a BGG list' }).click()
    await expect(page.getByRole('dialog', { name: 'Load a BGG list' })).toBeVisible()
    await expect(page).toHaveURL(/#\/lists\?load$/)
  })

  test('no orange primary button in a screen heading or the app bar (FR-019)', async ({ page }) => {
    await fakeBgg(page)
    await fakePreview(page)
    const collection = await newCollection(page)
    for (const hash of ['#/collections', collection.hash, '#/lists', '#/lists/preview/9093', '#/search', '#/config', '#/config/share']) {
      await page.goto(`/${hash}`)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('.top .btn-primary, .appbar .btn-primary'), hash).toHaveCount(0)
    }
  })

  test('the toast shows above the action bar; the page keeps room for the bar only where there is one', async ({ page }) => {
    await fakeBgg(page)
    const collection = await newCollection(page)
    await page.goto(`/${collection.hash}?add=game`)
    const sheet = page.getByRole('dialog', { name: 'Add game' })
    await sheet.getByLabel(/boardgamegeek link/i).fill('https://boardgamegeek.com/boardgame/295947/cascadia')
    await sheet.getByRole('button', { name: 'Add to collection' }).click()
    const toast = page.locator('.toast.show')
    await expect(toast).toContainText(`to ${collection.name}`)
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`${collection.hash}$`))
    const toastBox = await toast.boundingBox()
    const barBox = await actions(page).boundingBox()
    expect(toastBox && barBox && toastBox.y + toastBox.height <= barBox.y).toBe(true)

    const paddingBottom = () => page.locator('.app').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))
    expect(await paddingBottom()).toBeGreaterThanOrEqual(80)
    await page.goto('/#/config')
    await expect(page.getByRole('heading', { level: 1, name: 'Config' })).toBeVisible()
    expect(await paddingBottom()).toBeLessThan(48)
  })
})
