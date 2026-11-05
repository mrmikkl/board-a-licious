import { expect, test } from '@playwright/test'

import { expectAccessible, seedCollection, unique } from './helpers.ts'

// F005 US2 (contracts/ui.md "Collection screen", "Sheets", "Game details"): quick filters, search, folding
test.beforeEach(async ({ page }) => {
  await seedCollection(page, unique('Quick'), [
    { bggId: 7001, name: 'Quartz Harbour', mark: 'must_have' },
    { bggId: 7002, name: 'Beryl Trail', mark: 'interested', bought: true, paidCents: 2000 },
    { bggId: 7003, name: 'Garnet Ridge', mark: 'unsure', booth: '3-R400' },
    { bggId: 7004, name: 'Dune Market', mark: 'poop' },
    { bggId: 7005, name: 'Kestrel Nights', mark: 'skip', booth: '3-A100' },
    { bggId: 7006, name: 'Zircon Later', mark: 'later' },
  ])
})

const filterAction = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: /^Filter/ })
const buyChip = (page: import('@playwright/test').Page) => page.getByRole('button', { name: '🛒 Buy' })

test('the quick filters sit between the two separators, with no filter summary line', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Quick filters' })).toBeVisible()
  await expect(page.locator('.filter-summary')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: /^Search / })).toHaveAttribute('placeholder', 'Search this collection')
})

test('the Cat | Booth toggle switches the grouping and its name', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Grouped by categories; tap to group by booths' })
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Grouped by booths; tap to group by categories' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Hall 3/ })).toBeVisible()
  await page.getByRole('button', { name: 'Grouped by booths; tap to group by categories' }).click()
  await expect(page.getByRole('button', { name: /^⭐ Must Have/ })).toBeVisible()
})

test('the Buy chip shows the games still to buy, marks the Filter action active, and counts them', async ({ page }) => {
  await expect(buyChip(page)).toHaveAttribute('aria-pressed', 'false')
  await buyChip(page).click()
  await expect(buyChip(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Quartz Harbour, Must Have', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Garnet Ridge, Unsure', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Beryl Trail, Interested, bought', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dune Market, Poop', exact: true })).toHaveCount(0)
  await expect(page.getByText('2 games')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: 'Filter (active)' })).toBeVisible()
  await expectAccessible(page)
})

test('changing a segment in the Filter sheet turns the Buy chip off', async ({ page }) => {
  await buyChip(page).click()
  await page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: 'Filter (active)' }).click()
  await page.getByRole('dialog', { name: 'Filter and group' }).getByRole('button', { name: 'All', exact: true }).first().click()
  await page.getByRole('dialog', { name: 'Filter and group' }).getByRole('button', { name: 'Done' }).click()
  await expect(buyChip(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Beryl Trail, Interested, bought', exact: true })).toBeVisible()
})

test('Clear filters is disabled at the default and resets everything', async ({ page }) => {
  await filterAction(page).click()
  const sheet = page.getByRole('dialog', { name: 'Filter and group' })
  await expect(sheet.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await buyChip(page).click()
  await page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: 'Filter (active)' }).click()
  await page.getByRole('dialog', { name: 'Filter and group' }).getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('status')).toHaveText('Filters cleared')
  await expect(buyChip(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('navigation', { name: 'Actions' }).getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Beryl Trail, Interested, bought', exact: true })).toBeVisible()
})

test('Not interested games show under booths only while the filter lets them through', async ({ page }) => {
  await page.getByRole('button', { name: 'Grouped by categories; tap to group by booths' }).click()
  await expect(page.getByRole('button', { name: 'Kestrel Nights, Not interested', exact: true })).toBeVisible()
  await filterAction(page).click()
  const sheet = page.getByRole('dialog', { name: 'Filter and group' })
  await sheet.getByRole('checkbox', { name: /Not interested/ }).uncheck()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Kestrel Nights, Not interested', exact: true })).toHaveCount(0)
})

test('search narrows by name; no match says so and offers to clear it', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: /^Search / })
  await search.fill('quartz')
  await expect(page.getByRole('button', { name: 'Quartz Harbour, Must Have', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Beryl Trail, Interested, bought', exact: true })).toHaveCount(0)
  await search.fill('zzz')
  await expect(page.getByText('No game called “zzz” here.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear the search' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Beryl Trail, Interested, bought', exact: true })).toBeVisible()
})

test('every group folds; For later, Poop and Not interested start folded; folding is not remembered', async ({ page }) => {
  for (const name of [/For later/, /Poop/, /Not interested/]) await expect(page.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false')
  const mustHave = page.getByRole('button', { name: /^⭐ Must Have/ })
  await expect(mustHave).toHaveAttribute('aria-expanded', 'true')
  await mustHave.click()
  await expect(mustHave).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Quartz Harbour, Must Have', exact: true })).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: /^⭐ Must Have/ })).toHaveAttribute('aria-expanded', 'true')
})
