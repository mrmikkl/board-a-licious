import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakePrices, fakeSearch, goTo, mainButton, openMenu, openTab, seedCollection, unique } from './helpers.ts'

/** F008 US0 (contracts/ui.md, docs/design.md 3.0.0): the places Buy, Lists and Config, their tabs and the one game sheet. */
const apiFixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8'))

const CASCADIA: FakeResult = { bggId: 295947, name: 'Cascadia', year: 2021, kind: 'boardgame' }
const LANDMARKS: FakeResult = { bggId: 385318, name: 'Cascadia: Landmarks', year: 2023, kind: 'expansion' }

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menu' })
const tablist = (page: Page, name: 'Buy' | 'Lists') => page.getByRole('tablist', { name })
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true })

/** A preview and a geeklist with ids of their own, from the recorded preview's first page. */
async function fakeLists(page: Page) {
  const previewId = 900000 + Math.floor(Math.random() * 90000)
  const geeklistId = previewId + 1
  const one = apiFixture('preview-9093-page-1.json')
  await page.route(`**/api/bgg/lists/preview/${previewId}?**`, route => route.fulfill({ json: { ...one, id: previewId, pageCount: 1, title: `Preview ${previewId}` } }))
  await page.route(`**/api/bgg/lists/geeklist/${geeklistId}?**`, route =>
    route.fulfill({ json: { ...one, kind: 'geeklist', id: geeklistId, isEssen: false, pageCount: 1, title: `Geeklist ${geeklistId}` } }),
  )
  return { previewId, geeklistId }
}

test('the menu holds Buy, Lists and Config with the current place marked', async ({ page }) => {
  await page.goto('/#/buy')
  await openMenu(page)
  await expect(menu(page).getByRole('link')).toHaveText(['Buy', 'Lists', 'Config'])
  await expect(menu(page).locator('[aria-current="page"]')).toHaveText('Buy')
  await menu(page).getByRole('link', { name: 'Lists' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lists' })).toBeVisible()
  await openMenu(page)
  await expect(menu(page).locator('[aria-current="page"]')).toHaveText('Lists')
  await page.keyboard.press('Escape')
  await page.goto('/#/config')
  await openMenu(page)
  await expect(menu(page).locator('[aria-current="page"]')).toHaveText('Config')
})

test('Buy has the tabs Search and Shopping lists; the last one is remembered after a reload', async ({ page }) => {
  await page.goto('/#/buy')
  await expect(tablist(page, 'Buy').getByRole('tab')).toHaveText(['Search', 'Shopping lists'])
  await expect(tab(page, 'Search')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'false')
  // Search has no action bar
  await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)

  await openTab(page, 'Shopping lists')
  await expect(page).toHaveURL(/#\/buy\/lists$/)
  await expect(mainButton(page)).toHaveAccessibleName('Create a shopping list')
  await page.reload()
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'true')
  // the menu opens Buy on its last tab
  await page.goto('/#/config')
  await goTo(page, 'Buy')
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'true')
  await openTab(page, 'Search')
  await goTo(page, 'Config')
  await goTo(page, 'Buy')
  await expect(tab(page, 'Search')).toHaveAttribute('aria-selected', 'true')
})

test('Lists has the tabs Status lists, Previews and Geeklists, Load a BGG list on each; the last one is remembered', async ({ page }) => {
  const { previewId, geeklistId } = await fakeLists(page)
  await page.goto(`/#/lists/preview/${previewId}`)
  await expect(page.getByRole('heading', { level: 1, name: `Preview ${previewId}` })).toBeVisible()
  await page.goto(`/#/lists/geeklist/${geeklistId}`)
  await expect(page.getByRole('heading', { level: 1, name: `Geeklist ${geeklistId}` })).toBeVisible()
  // back from a geeklist goes to its tab
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/lists/geeklists')

  await page.goto('/#/lists/status')
  await expect(tablist(page, 'Lists').getByRole('tab')).toHaveText(['Status lists', 'Previews', 'Geeklists'])
  await expect(tab(page, 'Status lists')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'What you own, wish for and want to play' })).toBeVisible()
  await expect(mainButton(page)).toHaveAccessibleName('Load a BGG list')

  await openTab(page, 'Previews')
  await expect(page.getByRole('link', { name: new RegExp(`Preview ${previewId}`) })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(`Geeklist ${geeklistId}`) })).toHaveCount(0)
  await expect(mainButton(page)).toHaveAccessibleName('Load a BGG list')

  await openTab(page, 'Geeklists')
  await expect(page.getByRole('link', { name: new RegExp(`Geeklist ${geeklistId}`) })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(`Preview ${previewId}`) })).toHaveCount(0)
  await expect(mainButton(page)).toHaveAccessibleName('Load a BGG list')

  await page.reload()
  await expect(tab(page, 'Geeklists')).toHaveAttribute('aria-selected', 'true')
  await page.goto('/#/lists')
  await expect(tab(page, 'Geeklists')).toHaveAttribute('aria-selected', 'true')
  // the arrow keys move between the tabs
  await tab(page, 'Geeklists').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(tab(page, 'Previews')).toBeFocused()
  await expect(tab(page, 'Previews')).toHaveAttribute('aria-selected', 'true')
})

test('Shopping lists shows the seeded shopping lists; a shopping list goes back to Shopping lists', async ({ page }) => {
  const name = unique('Places')
  const id = await seedCollection(page, name, [{ bggId: 295947, name: 'Cascadia', mark: 'interested' }])
  await expect(page).toHaveURL(new RegExp(`#/buy/lists/${id}$`))
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/buy/lists')
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  await mainButton(page).click()
  await expect(page.getByRole('dialog', { name: 'New shopping list' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create shopping list' })).toBeDisabled()
})

test('a Buy › Search result is a list game row without Add; it opens the game sheet with its prices open', async ({ page }) => {
  await fakeSearch(page, { results: { cascad: [CASCADIA, LANDMARKS] } })
  await fakePrices(page)
  await page.goto('/#/buy')
  await page.getByRole('searchbox', { name: 'Find a game' }).fill('cascad')
  const row = page.locator('.list-row').filter({ has: page.getByRole('button', { name: 'Cascadia, 2021', exact: true }) })
  await expect(page.getByRole('button', { name: 'Cascadia: Landmarks, 2023, expansion' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Add Cascadia to shopping lists' })).toHaveCount(0)
  await expectAccessible(page)

  await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
  await expect(page).toHaveURL(/#\/buy\?game=295947$/)
  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet.getByText('2021 · Flatout Games')).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Open on BoardGameGeek/ })).toHaveAttribute('href', 'https://boardgamegeek.com/boardgame/295947')
  await expect(sheet.locator('.facts-box')).toContainText('1–4 players')
  await expect(sheet.getByRole('button', { name: /Prices/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.getByRole('button', { name: 'Add to shopping lists' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: '✅ Bought it' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Category/ })).toHaveCount(0)
  await expect(sheet.getByText('About Cascadia.')).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('dialog', { name: 'Cascadia' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/buy$/)
})

test('in a shopping list the game sheet has the folded Category, Prices and Copy/Move/Remove, no hexagon picker', async ({ page }) => {
  const name = unique('Sheet')
  const other = unique('Other')
  // a game id of its own: other tests put Cascadia into many shopping lists of the shared dev user
  const bggId = 8_000_000 + Math.floor(Math.random() * 900_000)
  await seedCollection(page, other, [{ bggId, name: 'Cascadia' }])
  await seedCollection(page, name, [{ bggId, name: 'Cascadia', mark: 'interested' }])
  await page.getByRole('button', { name: /^Cascadia/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Cascadia' })
  await expect(sheet.getByRole('group', { name: 'Category' })).toHaveCount(0)
  const category = sheet.getByRole('button', { name: /Category/ })
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await expect(category).toContainText('Interested')
  await expect(sheet.getByRole('button', { name: /Prices/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(sheet.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Move', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: `Remove from ${name}` })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add to shopping lists' })).toHaveCount(0)
  // only the other shopping lists: "also in …"; it opens the shopping list choice
  await expect(sheet.getByRole('button', { name: new RegExp(`also in ${other}`) })).toBeVisible()
  await expectAccessible(page)

  await category.click()
  await expect(category).toHaveAttribute('aria-expanded', 'true')
  await sheet.getByRole('button', { name: /Must Have/ }).click()
  await expect(page.locator('.toast')).toHaveText('Cascadia → ⭐ Must Have')
  await expect(category).toHaveAttribute('aria-expanded', 'false')
  await expect(category).toContainText('Must Have')

  await sheet.getByRole('button', { name: new RegExp(`also in ${other}`) }).click()
  await expect(page.getByRole('dialog', { name: 'Add Cascadia' })).toBeVisible()
})

test('old addresses open the new places', async ({ page }) => {
  const name = unique('Old')
  const id = await seedCollection(page, name, [{ bggId: 295947, name: 'Cascadia' }])
  await page.goto('/#/collections')
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/buy\/lists$/)
  await page.goto(`/#/collections/${id}`)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/buy/lists/${id}$`))
  await page.goto('/#/search')
  await expect(tab(page, 'Search')).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/buy$/)
  await fakeSearch(page, { results: {} })
  await page.goto('/#/buy/295947')
  await expect(page).toHaveURL(/#\/buy\?game=295947$/)
  await expect(page.getByRole('dialog', { name: 'Cascadia' })).toBeVisible()
})

test('Buy and Lists are accessible at 360 px', async ({ page }) => {
  await page.goto('/#/buy')
  await expect(tab(page, 'Search')).toBeVisible()
  await expectAccessible(page)
  await page.goto('/#/buy/lists')
  await expect(tab(page, 'Shopping lists')).toHaveAttribute('aria-selected', 'true')
  await expectAccessible(page)
  await page.goto('/#/lists/status')
  await expect(tab(page, 'Status lists')).toHaveAttribute('aria-selected', 'true')
  await expectAccessible(page)
  await page.goto('/#/lists/previews')
  await expectAccessible(page)
})
