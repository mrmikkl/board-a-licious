import { type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, fakeBgg, unique } from './helpers.ts'

/**
 * F002 US1, the "Shared game" sheet (docs/design.md v1.9.0 "Shared game", "Choosing a collection";
 * T009, T011, T012). A share is simulated by opening the entry URL (contracts/share-target.md).
 */
const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'
const share = (page: Page) => page.goto(`/share-target?text=${encodeURIComponent(`Cascadia ${CASCADIA}`)}`)
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Add game' })
const collectionSelect = (page: Page) => sheet(page).getByLabel('Collection', { exact: true })

/** Picks a collection by its name; the option text may carry "(last used)" or "(already in it)". */
async function choose(page: Page, name: string) {
  const option = collectionSelect(page).locator('option').filter({ hasText: name })
  await collectionSelect(page).selectOption(await option.getAttribute('value'))
}

const optionText = (page: Page, name: string) => collectionSelect(page).locator('option').filter({ hasText: name })
const notYetMarked = (page: Page) => page.getByRole('region', { name: /not yet marked/i })

test('share a game: preselected last used collection, add, toast, and the next share preselects it (T009, T011)', async ({ page }) => {
  await fakeBgg(page)
  const first = unique('Shared A')
  const second = unique('Shared B')
  await createCollection(page, first)
  await createCollection(page, second)

  await share(page)
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page).getByLabel('Name', { exact: true })).toHaveValue('Cascadia')
  await expect(sheet(page)).toContainText('Shared from BoardGameGeek')
  await expectAccessible(page)

  // choose the first collection and add: that collection opens, history replaced
  await choose(page, first)
  await sheet(page).getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible()
  await expect(page).toHaveURL(/#\/collections\//)
  await expect(page.getByRole('status').filter({ hasText: `Added Cascadia to ${first}` })).toBeVisible()
  await expect(notYetMarked(page).getByRole('button', { name: /cascadia/i })).toBeVisible()

  // the next share preselects it, marked "(last used)", with the hint
  await share(page)
  await expect(sheet(page)).toBeVisible()
  await expect(optionText(page, first)).toHaveText(`${first} (already in it)`)
  await choose(page, second)
  await expect(optionText(page, second)).toHaveText(second)
  await sheet(page).getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: second })).toBeVisible()

  // a share of another game: the collection shared into last is preselected and marked
  await page.goto(`/share-target?url=${encodeURIComponent('https://boardgamegeek.com/boardgame/342942/ark-nova')}`)
  await expect(sheet(page)).toBeVisible()
  await expect(collectionSelect(page)).toHaveValue((await optionText(page, second).getAttribute('value'))!)
  await expect(optionText(page, second)).toHaveText(`${second} (last used)`)
  await expect(sheet(page)).toContainText('Preselected: the collection you last shared into.')
})

test('a game already in the chosen collection: marked, red hint, Add disabled until another is chosen; the sheet stays (T009, T011)', async ({ page }) => {
  await fakeBgg(page)
  const holding = unique('Shared In')
  const other = unique('Shared Out')
  await createCollection(page, other)
  await createCollection(page, holding)
  await share(page)
  await choose(page, holding)
  await sheet(page).getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: holding })).toBeVisible()

  await share(page)
  await expect(sheet(page)).toBeVisible()
  // the same sheet element throughout: changing the dropdown does not re-mount (or re-slide) it
  await sheet(page).evaluate(el => ((window as unknown as { sharedSheet: Element }).sharedSheet = el))
  await expect(optionText(page, holding)).toHaveText(`${holding} (already in it)`)
  await expect(sheet(page)).toContainText(`Cascadia is already in ${holding}. Pick another collection.`)
  await expect(sheet(page).getByRole('button', { name: 'Add to collection' })).toBeDisabled()
  await expectAccessible(page)

  await choose(page, other)
  await expect(sheet(page)).not.toContainText('is already in')
  await expect(sheet(page).getByRole('button', { name: 'Add to collection' })).toBeEnabled()
  expect(await sheet(page).evaluate(el => el === (window as unknown as { sharedSheet: Element }).sharedSheet)).toBe(true)

  // an edited name is what gets added
  await sheet(page).getByLabel('Name', { exact: true }).fill('  Cascadia (2021)  ')
  await sheet(page).getByRole('button', { name: 'Add to collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: other })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: `Added Cascadia (2021) to ${other}` })).toBeVisible()
})

test('Cancel adds nothing (T009, T011)', async ({ page }) => {
  await fakeBgg(page)
  const name = unique('Shared Cancel')
  await createCollection(page, name)
  await share(page)
  await choose(page, name)
  await sheet(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet(page)).toHaveCount(0)
  await page.goto('/#/collections')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('button', { name: /cascadia/i })).toHaveCount(0)
})

test('no collection yet: "Create and add" creates one with the game in it (T009, T012)', async ({ page }) => {
  await fakeBgg(page)
  // a new person: the server has nothing for them
  await page.route('**/api/sync**', route =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { collections: [], entries: [], lists: [], serverTime: new Date().toISOString() } })
      : route.fulfill({ json: { applied: 0, ignored: 0 } }),
  )
  await share(page)
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page)).toContainText('A game goes into a collection, and you have none yet. Create one, and Cascadia goes straight into it.')
  const name = sheet(page).getByLabel('Collection name')
  await expect(name).toHaveValue('SPIEL 2026')
  await expectAccessible(page)

  await name.fill('')
  await expect(sheet(page).getByRole('button', { name: 'Create and add' })).toBeDisabled()
  const created = unique('Shared New')
  await name.fill(created)
  await sheet(page).getByRole('button', { name: 'Create and add' }).click()
  await expect(page.getByRole('heading', { level: 1, name: created })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: `Added Cascadia to ${created}` })).toBeVisible()
  await expect(notYetMarked(page).getByRole('button', { name: /cascadia/i })).toBeVisible()
})
