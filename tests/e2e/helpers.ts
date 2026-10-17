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
