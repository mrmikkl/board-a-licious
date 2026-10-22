import { type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, fakeBgg, fakeGallery, unique } from './helpers.ts'

/**
 * F004 US2 (FR-007–FR-014, contracts/images-api.md "Show-off"): the Show-off action at the outer
 * right of a collection's action bar opens the group sheet; Show off opens the honeycomb of the
 * chosen groups' covers; a hexagon opens the image viewer.
 */

const GAMES = {
  cascadia: 'https://boardgamegeek.com/boardgame/295947/cascadia',
  arkNova: 'https://boardgamegeek.com/boardgame/342942/ark-nova',
  wingspan: 'https://boardgamegeek.com/boardgame/266192/wingspan',
  brass: 'https://boardgamegeek.com/boardgame/224517/brass-birmingham',
}

const actions = (page: Page) => page.getByRole('navigation', { name: 'Actions' })
const showOffButton = (page: Page) => actions(page).getByRole('button', { name: 'Show-off' })
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Show-off' })
const honeycomb = (page: Page) => page.locator('.honeycomb')
const hexagons = (page: Page) => honeycomb(page).getByRole('button')
const pressed = (page: Page) => sheet(page).locator('button[aria-pressed]').evaluateAll(els => els.map(el => el.getAttribute('aria-pressed')))
const names = (page: Page) => hexagons(page).evaluateAll(els => els.map(el => el.getAttribute('aria-label')))

async function addGame(page: Page, link: string, game: string) {
  await actions(page).getByRole('button', { name: /^add game$/i }).click()
  const add = page.getByRole('dialog', { name: 'Add game' })
  await add.getByLabel(/boardgamegeek link/i).fill(link)
  await expect(add.getByLabel(/^name$/i)).toHaveValue(game)
  await add.getByRole('button', { name: 'Add to collection' }).click()
  await expect(add).toBeHidden()
  await expect(page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: new RegExp(game, 'i') })).toBeVisible()
}

/** Opens the game from "No category yet" and picks a category; a tap changes it in place, Escape closes the details. */
async function markAs(page: Page, game: string, mark: RegExp) {
  await page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: new RegExp(game, 'i') }).click()
  await page.getByRole('dialog').getByRole('button', { name: mark }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function buy(page: Page, group: RegExp, game: string) {
  await page.getByRole('region', { name: group }).getByRole('button', { name: new RegExp(game, 'i') }).click()
  const details = page.getByRole('dialog')
  await details.getByRole('button', { name: /bought it/i }).click()
  await details.getByRole('button', { name: 'Got it' }).click()
  await expect(details).toBeHidden()
}

test('US2: Show-off sheet, honeycomb of the chosen groups, viewer from a hexagon, remembered choice', async ({ page }) => {
  await fakeBgg(page)
  await fakeGallery(page)
  const name = unique('Essen')
  await createCollection(page, name)

  // FR-007: the action bar order is Add game · ♥ · Filter · Show-off
  await expect(actions(page).locator('a, button')).toHaveText(['Add game', '', 'Filter', 'Show-off'])

  await addGame(page, GAMES.cascadia, 'Cascadia')
  await addGame(page, GAMES.arkNova, 'Ark Nova')
  await addGame(page, GAMES.wingspan, 'Wingspan')
  await addGame(page, GAMES.brass, 'Brass Birmingham')
  await markAs(page, 'Cascadia', /must have/i)
  await markAs(page, 'Ark Nova', /must have/i)
  await markAs(page, 'Wingspan', /must have/i)
  await markAs(page, 'Brass Birmingham', /^interested$/i)
  await buy(page, /must have/i, 'Cascadia')

  // FR-008, FR-009: seven toggles with counts, Must Have pressed the first time, Show off disabled with none pressed
  await showOffButton(page).click()
  const dialog = sheet(page)
  await expect(dialog).toBeVisible()
  const toggles = dialog.locator('button[aria-pressed]')
  await expect(toggles).toHaveText(['⭐ Must Have 3', '👀 Interested 1', '🤔 Unsure 0', '⏳ For later 0', '💩 Poop 0', '⬡ No category yet 0', '🛑 Not interested 0'])
  await expect.poll(() => pressed(page)).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false'])
  const showOff = dialog.getByRole('button', { name: 'Show off' })
  await expect(showOff).toBeEnabled()
  await toggles.nth(0).click()
  await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(showOff).toBeDisabled()
  await toggles.nth(0).click()
  await toggles.nth(1).click()
  await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expectAccessible(page)
  await showOff.click()

  // FR-010, FR-011, FR-013: heading, marks line, one hexagon per game in order, honeycomb rows
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Show-off' })).toBeVisible()
  await expect(page.getByText(`${name} · ⭐ 👀 · 4 games`)).toBeVisible()
  await expect.poll(() => names(page)).toEqual(['Ark Nova, Must Have', 'Cascadia, Must Have', 'Wingspan, Must Have', 'Brass Birmingham, Interested'])
  const boxes = await Promise.all([0, 1, 2, 3].map(i => hexagons(page).nth(i).boundingBox()))
  const [a, b, c, d] = boxes as { x: number; y: number; width: number; height: number }[]
  expect(b!.y).toBeCloseTo(a!.y, 0)
  expect(c!.y).toBeCloseTo(a!.y, 0)
  expect(b!.x).toBeGreaterThan(a!.x)
  expect(c!.x).toBeGreaterThan(b!.x)
  // the second row starts half a hexagon (plus half the gap) to the right and overlaps the first
  expect(Math.abs(d!.x - (a!.x + (a!.width + 4) / 2))).toBeLessThan(2)
  expect(d!.y).toBeGreaterThan(a!.y)
  expect(d!.y).toBeLessThan(a!.y + a!.height)
  expect(a!.height / a!.width).toBeCloseTo(1.1547, 1)
  // the bought game carries the tick
  await expect(hexagons(page).nth(1).locator('.honeycomb-got')).toHaveText('✓')
  await expect(hexagons(page).nth(0).locator('.honeycomb-got')).toHaveCount(0)
  await expectAccessible(page)

  // FR-012: a hexagon opens the viewer; closing returns to the honeycomb
  await hexagons(page).nth(1).click()
  const viewer = page.getByRole('dialog', { name: 'Images of Cascadia' })
  await expect(viewer).toBeVisible()
  await viewer.getByRole('button', { name: 'Close' }).click()
  await expect(viewer).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Show-off' })).toBeVisible()
  await expect(hexagons(page)).toHaveCount(4)

  // reloading the screen's address shows the same honeycomb
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Show-off' })).toBeVisible()
  await expect.poll(() => names(page)).toEqual(['Ark Nova, Must Have', 'Cascadia, Must Have', 'Wingspan, Must Have', 'Brass Birmingham, Interested'])

  // FR-013: Back returns to the collection
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  // FR-009: Show-off again preselects Must Have + Interested
  await showOffButton(page).click()
  await expect.poll(() => pressed(page)).toEqual(['true', 'true', 'false', 'false', 'false', 'false', 'false'])
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('US2: groups without games show the empty state; Show-off works offline after the collection was loaded', async ({ page, context }) => {
  await fakeBgg(page)
  await fakeGallery(page)
  const name = unique('Empty')
  await createCollection(page, name)
  await addGame(page, GAMES.cascadia, 'Cascadia')

  // FR-013: no game in the chosen categories → empty state, Choose categories opens the sheet
  await showOffButton(page).click()
  const dialog = sheet(page)
  await dialog.getByRole('button', { name: /must have/i }).click()
  await dialog.getByRole('button', { name: /poop/i }).click()
  await dialog.getByRole('button', { name: 'Show off' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Show-off' })).toBeVisible()
  await expect(page.getByText(`${name} · 💩 · 0 games`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No game in these categories' })).toBeVisible()
  await expect(hexagons(page)).toHaveCount(0)
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Choose categories' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /poop/i })).toHaveAttribute('aria-pressed', 'true')

  // FR-014: offline, the honeycomb shows the covers on the phone
  await context.setOffline(true)
  await dialog.getByRole('button', { name: /poop/i }).click()
  await dialog.getByRole('button', { name: /no category yet/i }).click()
  await dialog.getByRole('button', { name: 'Show off' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(`${name} · ⬡ · 1 game`)).toBeVisible()
  await expect.poll(() => names(page)).toEqual(['Cascadia, No category yet'])
  await hexagons(page).first().click()
  const viewer = page.getByRole('dialog', { name: 'Images of Cascadia' })
  await expect(viewer).toBeVisible()
  await viewer.getByRole('button', { name: 'Close' }).click()
  await expect(viewer).toBeHidden()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await context.setOffline(false)
})
