import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { type Place, fakeBgg, goTo, openMenu, unique } from './helpers.ts'

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
  const back = page.getByRole('link', { name: 'Back' })

  const screens: { hash: string; heading: string | RegExp; place: Place; back?: string }[] = [
    { hash: '#/collections', heading: 'Collections', place: 'Collections' },
    { hash: collection.hash, heading: collection.name, place: 'Collections' },
    { hash: '#/lists', heading: 'BGG lists', place: 'BGG lists' },
    { hash: '#/lists/preview/9093', heading: /spiel/i, place: 'BGG lists', back: '#/lists' },
    { hash: `${collection.hash}/swipe`, heading: `Add to ${collection.name}`, place: 'Collections', back: collection.hash },
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
