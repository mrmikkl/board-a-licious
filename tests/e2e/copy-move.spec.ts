import { expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, seedCollection, unique } from './helpers.ts'

/**
 * F005 US6 (FR-026a–c; research R11): copy keeps the category and facts but not the purchase;
 * move takes everything along; the sheet offers only collections without the game.
 */
test('copy to another collection, then move it on: category and price come along', async ({ page }) => {
  await fakeBgg(page)
  const home = unique('Home')
  const essen = unique('Essen')
  const third = unique('Third')
  const essenId = await seedCollection(page, essen, [])
  const thirdId = await seedCollection(page, third, [])
  const homeId = await seedCollection(page, home, [{ bggId: 295947, name: 'Cascadia', booth: '3-A101', priceCents: 3800, mark: 'must_have', bought: true, paidCents: 3800 }])

  await page.getByRole('button', { name: /^cascadia/i }).first().click()
  const details = page.getByRole('dialog')
  await expect(details.getByRole('button', { name: 'Copy to collection' })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Move to collection' })).toBeVisible()
  await expect(details.getByRole('button', { name: `Remove from ${home}` })).toBeVisible()
  await expectAccessible(page)

  // copy: the details stay open, the game is in both collections, the purchase stays here
  await details.getByRole('button', { name: 'Copy to collection' }).click()
  const copy = page.getByRole('dialog', { name: 'Copy Cascadia' })
  const choice = copy.getByLabel('To collection')
  await expect(choice.getByRole('option', { name: `${home} (already in it)` })).toBeDisabled()
  await choice.selectOption({ label: essen })
  await copy.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByText(`Copied Cascadia to ${essen}`)).toBeVisible()
  await expect(copy).toBeHidden()
  await expect(details.getByRole('button', { name: /not bought/i })).toBeVisible()

  // move: the details close; the game is gone here and in the target with its category and purchase
  await details.getByRole('button', { name: 'Move to collection' }).click()
  const move = page.getByRole('dialog', { name: 'Move Cascadia' })
  await expect(move.getByLabel('To collection').getByRole('option', { name: `${essen} (already in it)` })).toBeDisabled()
  await move.getByLabel('To collection').selectOption({ label: third })
  await move.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByText(`Moved Cascadia to ${third}`)).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /cascadia/i })).toHaveCount(0)

  await page.goto(`/#/collections/${homeId}`)
  await page.reload()
  await expect(page.getByRole('button', { name: /cascadia/i })).toHaveCount(0)
  await page.goto(`/#/collections/${thirdId}`)
  await page.reload()
  const cascadiaRow = page.getByRole('region', { name: /must have/i }).locator('.row', { hasText: 'Cascadia' })
  await expect(cascadiaRow).toContainText('€38')
  await page.goto(`/#/collections/${essenId}`)
  await page.reload()
  await expect(cascadiaRow).toBeVisible()
  // the copy kept category and listed facts, but not the purchase
  await cascadiaRow.click()
  await expect(page.getByRole('dialog').getByRole('button', { name: /bought it/i })).toBeVisible()
})
