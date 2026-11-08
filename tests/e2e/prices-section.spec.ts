import { expect, test } from '@playwright/test'

import { type FakeResult, expectAccessible, fakePrices, fakeSearch, seedCollection, unique } from './helpers.ts'

test.describe('F007 US2: prices in a game\'s details', () => {
  test('folded until tapped; then offers with the fair price on top; tap again folds', async ({ page }) => {
    const asked: string[] = []
    await fakePrices(page, {}, { asked })
    const bggId = 5_000_000 + Math.floor(Math.random() * 1_000_000)
    await seedCollection(page, unique('Essen 2026'), [{ bggId, name: 'Cascadia', mark: 'interested', booth: '3-A101', priceCents: 3800 }])
    await page.getByRole('button', { name: /^Cascadia,/ }).first().click()
    const sheet = page.getByRole('dialog')
    const toggle = sheet.getByRole('button', { name: 'Prices' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(asked).toEqual([])
    await toggle.click()
    await expect(sheet.getByText('At the fair: €38')).toBeVisible()
    await expect(sheet.getByRole('list', { name: 'New offers' }).getByRole('link')).toHaveCount(3)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain(`bggId=${bggId}`)
    await expectAccessible(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(sheet.getByRole('list', { name: 'New offers' })).toBeHidden()
  })

  test('the game sheet of Buy › Search has the same section, open from the start', async ({ page }) => {
    const game: FakeResult = { bggId: 295947, name: 'Cascadia', year: 2021, kind: 'boardgame' }
    await fakeSearch(page, { results: { cascad: [game] } })
    await fakePrices(page)
    await page.goto('/#/buy')
    await page.getByRole('searchbox', { name: 'Find a game' }).fill('cascad')
    await page.getByRole('button', { name: 'Cascadia, 2021', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Cascadia' })
    await expect(sheet.getByRole('button', { name: 'Prices' })).toHaveAttribute('aria-expanded', 'true')
    await sheet.getByRole('tab', { name: /^Used/ }).click()
    await expect(sheet.getByRole('list', { name: 'Used offers' }).getByRole('link')).toHaveCount(3)
  })
})
