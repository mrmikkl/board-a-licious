import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

async function createCollection(page: Page, name: string) {
  await page.goto('/#/collections')
  await page.getByRole('link', { name: /add a collection, bgg list or game/i }).click()
  await page.getByRole('button', { name: /^collection/i }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function addMustHave(page: Page, collection: string, link: string, game: string) {
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill(link)
  await expect(page.getByLabel(/^name$/i)).toHaveValue(game)
  await page.getByRole('button', { name: 'Add to collection' }).click()
  await page.getByRole('region', { name: /not yet marked/i }).getByRole('button', { name: new RegExp(game, 'i') }).click()
  await page.getByRole('dialog').getByRole('button', { name: /must have/i }).click()
  // choosing a mark closes the sheet; open the game again from its new group
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('region', { name: /must have/i }).getByRole('button', { name: new RegExp(game, 'i') }).click()
}

test('US4: manual facts, bought with a price, money spent, filter', async ({ page }) => {
  await fakeBgg(page)
  const name = unique('Essen 2026')
  await createCollection(page, name)
  await addMustHave(page, name, 'https://boardgamegeek.com/boardgame/295947/cascadia', 'Cascadia')
  const sheet = page.getByRole('dialog')

  // FR-018: description from BGG; FR-011: booth, price and publisher typed in by hand
  await expect(sheet.getByText(/harmonious ecosystem/i)).toBeVisible()
  await sheet.getByRole('button', { name: /add booth, price and publisher/i }).click()
  const save = sheet.getByRole('button', { name: /^save$/i })
  await expect(save).toBeDisabled()
  await sheet.getByLabel('Booth').fill('3-A101')
  await sheet.getByLabel('Price', { exact: true }).fill('52')
  await sheet.getByLabel('Publisher').fill('AEG')
  await expectAccessible(page)
  await save.click()
  await expect(sheet.getByText('Added by you')).toBeVisible()
  await expect(sheet.getByText('3-A101')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /edit/i })).toBeVisible()

  // FR-007: bought, prefilled with the listed price; Enter saves
  await sheet.getByRole('button', { name: /bought it/i }).click()
  const paid = sheet.getByLabel('What did you pay?')
  await expect(paid).toHaveValue('52')
  await expect(sheet.getByRole('button', { name: /don't track the price/i })).toBeVisible()
  await expectAccessible(page)
  await paid.press('Enter')
  await expect(sheet).toBeHidden()

  // the game keeps its group, shows the price paid; the collection shows what was spent
  const mustHave = page.getByRole('region', { name: /must have/i })
  await expect(mustHave.getByRole('button', { name: /cascadia/i })).toContainText('✅ €52')
  await expect(mustHave.getByRole('button', { name: /cascadia/i })).toContainText('3-A101 · €52 · AEG')
  await expect(page.getByText('✅ 1 game bought, €52 spent')).toBeVisible()

  // FR-009: the hunt preset hides bought games and remembers itself
  await addMustHave(page, name, 'https://boardgamegeek.com/boardgame/342942/ark-nova', 'Ark Nova')
  await expect(sheet.getByText('The description is filled in from BoardGameGeek later.')).toBeVisible()
  await page.keyboard.press('Escape')
  // filter and grouping hide behind the filter icon; nothing narrowed, so no summary line
  const icon = page.getByRole('button', { name: /^filter and group/i })
  const summary = page.locator('.filter-summary')
  await expect(summary).toHaveCount(0)
  await icon.click()
  const panel = page.getByRole('group', { name: 'Filter' })
  await expect(panel.getByRole('checkbox', { name: /must have/i })).toBeChecked()
  await expectAccessible(page)
  // no presets any more: Select none, tick Must Have, then Not bought
  await expect(panel.getByRole('button', { name: '⭐ Must Have, not bought' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Select none' }).click()
  await expect(panel.getByRole('checkbox', { name: /must have/i })).not.toBeChecked()
  await panel.getByRole('checkbox', { name: /must have/i }).check()
  await panel.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'Not bought' }).click()
  await expect(panel.getByRole('group', { name: 'Price' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
  await expect(panel).toBeHidden()
  await expect(icon).toHaveAccessibleName('Filter and group (active)')
  await expect(summary).toContainText('⭐ Must Have, not bought')
  await expect(summary).toContainText('1 game')
  await expect(page.getByRole('button', { name: /cascadia/i })).toBeHidden()
  await expect(page.getByRole('button', { name: /ark nova/i })).toBeVisible()

  await page.reload()
  await expect(summary).toContainText('⭐ Must Have, not bought')

  // buying the last Must Have without a price: nothing left to hunt
  await page.getByRole('button', { name: /ark nova/i }).click()
  await sheet.getByRole('button', { name: /bought it/i }).click()
  await sheet.getByRole('button', { name: /don't track the price/i }).click()
  await expect(page.getByRole('heading', { name: /nothing left to hunt/i })).toBeVisible()
  await expect(page.getByText('✅ 2 games bought, €52 spent')).toBeVisible()
  // the toast fades in; check contrast once it is fully shown
  await expect(page.getByRole('status')).toHaveCSS('opacity', '1')
  await expectAccessible(page)

  // un-buying from "All games": back in the hunt, the price paid is gone
  await summary.click()
  await panel.getByRole('button', { name: 'Select all' }).click()
  await panel.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'All' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
  await expect(panel).toBeHidden()
  await expect(summary).toHaveCount(0)
  await mustHave.getByRole('button', { name: /cascadia/i }).click()
  await sheet.getByRole('button', { name: /not bought after all/i }).click()
  await expect(mustHave.getByRole('button', { name: /cascadia/i })).not.toContainText('✅')
  await expect(page.getByText('✅ 1 game bought')).toBeVisible()
})
