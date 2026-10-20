import { readFileSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { type Page, expect } from '@playwright/test'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/bgg/${name}`, import.meta.url), 'utf8')

/** No end-to-end test calls the live BGG site: BGG-backed API routes answer from fixtures. */
export async function fakeBgg(page: Page) {
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    const item = JSON.parse(fixture('geekitems-295947.json')).item
    const games = ids.includes(295947)
      ? [{ bggId: 295947, name: item.name, year: Number(item.yearpublished), thumbnailUrl: item.images.square200, description: item.short_description, kind: 'boardgame' }]
      : []
    await route.fulfill({ json: { games } })
  })
}

/** A name nobody else's test run uses, as the dev server's database is shared between runs. */
export const unique = (name: string) => `${name} ${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
}

/** F003 navigation (contracts/navigation.md): the four places live in the app bar's menu. */
export type Place = 'Collections' | 'BGG lists' | 'Search' | 'Config'

export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible()
}

export async function goTo(page: Page, place: Place) {
  await openMenu(page)
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: place, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: place, exact: true })).toBeVisible()
}

/** The big hexagon in the action bar; its accessible name says what it does on the screen. */
export const mainButton = (page: Page) => page.getByRole('navigation', { name: 'Actions' }).locator('.main-btn')

/** Collections → main ＋ → New collection sheet → Create collection; ends in the new collection. */
export async function createCollection(page: Page, name: string) {
  if (page.url() === 'about:blank') await page.goto('/#/collections')
  await goTo(page, 'Collections')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'New collection' })
  await sheet.getByLabel('Name').fill(name)
  await sheet.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** BGG lists → main ＋ → Load a BGG list sheet → Load list; ends in the list. */
export async function loadList(page: Page, link: string) {
  if (page.url() === 'about:blank') await page.goto('/#/lists')
  await goTo(page, 'BGG lists')
  await mainButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'Load a BGG list' })
  await sheet.getByLabel(/link/i).fill(link)
  await sheet.getByRole('button', { name: 'Load list' }).click()
}
