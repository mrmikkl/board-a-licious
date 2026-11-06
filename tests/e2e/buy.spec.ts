import { type Page, expect, test } from '@playwright/test'

import { type FakeResult, CASCADIA_PRICES, expectAccessible, fakePrices, fakeSearch, openMenu } from './helpers.ts'

const CASCADIA: FakeResult = { bggId: 295947, name: 'Cascadia', year: 2021, kind: 'boardgame' }
const LANDMARKS: FakeResult = { bggId: 385318, name: 'Cascadia: Landmarks', year: 2023, kind: 'expansion' }

async function openPrices(page: Page) {
  await page.goto('/#/buy')
  await page.getByRole('searchbox', { name: "Find a game's prices" }).fill('cascad')
  await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
  await expect(page).toHaveURL(/#\/buy\/295947$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Prices' })).toBeVisible()
}
const newOffers = (page: Page) => page.getByRole('list', { name: 'New offers' }).getByRole('link')
const usedOffers = (page: Page) => page.getByRole('list', { name: 'Used offers' }).getByRole('link')

test.describe('F007 US1: find the best price for a game', () => {
  test('Buy is the first place in the menu', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA, LANDMARKS] } })
    await page.goto('/#/collections')
    await openMenu(page)
    await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link').first()).toHaveAccessibleName('Buy')
  })

  test('Buy searches BoardGameGeek; results have no + and open the prices', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA, LANDMARKS] } })
    await fakePrices(page)
    await page.goto('/#/buy')
    await expect(page.getByRole('heading', { level: 1, name: 'Buy' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Actions' })).toHaveCount(0)
    await page.getByRole('searchbox', { name: "Find a game's prices" }).fill('cascad')
    await expect(page.getByRole('button', { name: 'Cascadia: Landmarks, 2023, expansion' })).toBeVisible()
    await expect(page.getByRole('button', { name: /to a collection$/ })).toHaveCount(0)
    await expectAccessible(page)
  })

  test('the price screen lists new offers cheapest first and used ones below, each a link to the shop', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA] } })
    await fakePrices(page)
    await openPrices(page)
    await expect(newOffers(page)).toHaveCount(3)
    await expect(newOffers(page).nth(0)).toHaveAccessibleName('Shop in Germany, €34.99, English')
    await expect(newOffers(page).nth(1)).toHaveAccessibleName('Shop in Germany, €35.39, German')
    await expect(newOffers(page).nth(2)).toHaveAccessibleName('Shop in Germany, €33.90, German, not in stock')
    await expect(newOffers(page).first()).toHaveAttribute('target', '_blank')
    await expect(usedOffers(page)).toHaveCount(3)
    await expect(usedOffers(page).nth(0)).toHaveAccessibleName('BGG marketplace, €22, English, used')
    await expect(usedOffers(page).nth(2)).toHaveAccessibleName('BGG marketplace, £25 ≈ €29.41, language not stated, used')
    await expect(page.getByRole('link', { name: 'Search on Kleinanzeigen ↗' })).toHaveAttribute('href', 'https://www.kleinanzeigen.de/s-cascadia/k0')
    await expect(page.getByRole('link', { name: 'Search on eBay.de ↗' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Search on unknowns.de ↗' })).toHaveAttribute('href', /unknowns\.de\/search\/\?q=Cascadia&type=com\.viecode\.marketplace\.entry/)
    await expectAccessible(page)
  })

  test('new offers of unknown language show on request; New and Used fold', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA] } })
    await fakePrices(page)
    await openPrices(page)
    await page.getByRole('checkbox', { name: 'Show offers with unknown language (1)' }).check()
    // unknown shipping: after the offers with known shipping
    await expect(newOffers(page).nth(2)).toHaveAccessibleName('Shop in Belgium, €27.99, language unknown')
    const used = page.getByRole('button', { name: /^Used/ })
    await used.click()
    await expect(used).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('list', { name: 'Used offers' })).toBeHidden()
    await used.click()
    await expect(usedOffers(page)).toHaveCount(3)
  })

  test('a failed source is named with Retry; none found offers brettspielpreise.de', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA] } })
    await fakePrices(page, { failed: ['unknowns.de'] })
    await openPrices(page)
    await expect(page.getByText('unknowns.de is not reachable right now.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    await page.unroute('**/api/prices?**')
    await fakePrices(page, { offers: [] })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'No offers in English or German found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open on brettspielpreise.de' })).toHaveAttribute('href', CASCADIA_PRICES.siteSearch)
  })

  test('shows a loading state while prices load', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA] } })
    await fakePrices(page, {}, { delayMs: 1500 })
    await openPrices(page)
    await expect(page.getByRole('status').filter({ hasText: 'Looking for prices…' })).toBeVisible()
    await expect(newOffers(page)).toHaveCount(3)
  })
})

test.describe('F007 US3: choose which editions count', () => {
  test('German leaves German editions (and used offers of unstated language), and is remembered', async ({ page }) => {
    await fakeSearch(page, { results: { cascad: [CASCADIA] } })
    await fakePrices(page)
    await openPrices(page)
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'German' }).click()
    await expect(newOffers(page)).toHaveCount(2)
    await expect(usedOffers(page)).toHaveCount(2)
    await page.reload()
    await expect(page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'German' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Both' }).click()
  })
})
