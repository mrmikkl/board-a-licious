import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, fakeGallery, loadList, unique } from './helpers.ts'

const fixture = (dir: string, name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${dir}/${name}`, import.meta.url), 'utf8'))

/** A cover that loads offline too. */
const COVER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#8b5cf6"/></svg>')}`
const PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#4c5bff"/></svg>'

/** Cascadia (8 gallery images) and Faraway (a cover, no gallery) from fixtures; no image comes from BGG's CDN. */
async function fakeImages(page: Page) {
  await fakeGallery(page)
  const item = fixture('bgg', 'geekitems-295947.json').item
  const games = [
    { bggId: 295947, name: item.name, year: Number(item.yearpublished), thumbnailUrl: item.images.square200, description: item.short_description, kind: 'boardgame' },
    { bggId: 385761, name: 'Faraway', year: 2023, thumbnailUrl: COVER, description: 'Far away.', kind: 'boardgame' },
  ]
  // the details runner asks for games of other test runs too (shared database): answer those it knows
  await page.route('**/api/bgg/games?**', async route => {
    const ids = new URL(route.request().url()).searchParams.get('ids')?.split(',').map(Number) ?? []
    await route.fulfill({ json: { games: games.filter(g => ids.includes(g.bggId)) } })
  })
  await page.route('https://cf.geekdo-images.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: PICTURE }))
}

async function addGame(page: Page, id: number) {
  await page.getByRole('button', { name: /^add game$/i }).click()
  await page.getByLabel(/boardgamegeek link/i).fill(`https://boardgamegeek.com/boardgame/${id}/game`)
  await page.getByRole('button', { name: 'Add to collection' }).click()
}

const viewer = (page: Page, name: string) => page.getByRole('dialog', { name: `Images of ${name}` })
const open = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `Show the images of ${name} big` }).click()
  await expect(viewer(page, name)).toBeVisible()
}
const runningAnimations = (page: Page, name: string) => viewer(page, name).evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)

test('US1: the cover opens the gallery big; keys and swipes step, Esc, Close and Back close it (FR-001–FR-006)', async ({ page }) => {
  await fakeImages(page)
  await createCollection(page, unique('Viewer'))
  await addGame(page, 295947)
  await page.getByRole('button', { name: /cascadia/i }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Cascadia', exact: true })
  await expect(sheet).toBeVisible()

  await open(page, 'Cascadia')
  const dialog = viewer(page, 'Cascadia')
  await expect(dialog).toContainText('1 / 8')
  await expect(dialog.getByRole('img', { name: 'Cascadia, image 1 of 8' })).toBeVisible()
  await expect(dialog).toContainText('from BoardGameGeek')
  await expectAccessible(page)
  if (test.info().project.name === 'phone-reduced-motion') expect(await runningAnimations(page, 'Cascadia')).toBe(0)

  // arrow keys step; the viewer is not redrawn on the way (FR-002a)
  const before = await dialog.elementHandle()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(dialog).toContainText('3 / 8')
  await expect(dialog.getByRole('img', { name: 'Cascadia, image 3 of 8' })).toBeVisible()
  expect(await dialog.evaluate((el, handle) => el === handle, before)).toBe(true)
  if (test.info().project.name === 'phone-reduced-motion') expect(await runningAnimations(page, 'Cascadia')).toBe(0)
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(dialog).toContainText('1 / 8')

  // a swipe to the right at the first image springs back: still "1 / 8", the image fully in view
  const first = dialog.getByRole('img', { name: 'Cascadia, image 1 of 8' })
  const box = (await first.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(dialog).toContainText('1 / 8')
  await expect.poll(async () => (await first.boundingBox())!.x).toBeGreaterThanOrEqual(0)
  await expect.poll(async () => {
    const b = (await first.boundingBox())!
    return b.x + b.width
  }).toBeLessThanOrEqual(360)

  // a swipe to the left steps
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(dialog).toContainText('2 / 8')

  // Esc closes the viewer only; focus returns to the cover
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(sheet).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show the images of Cascadia big' })).toBeFocused()

  await open(page, 'Cascadia')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(sheet).toBeVisible()

  await open(page, 'Cascadia')
  await page.goBack()
  await expect(dialog).toBeHidden()
  await expect(sheet).toBeVisible()
})

test('US1: a game without gallery shows its cover big with a note; offline, the note says so (FR-005)', async ({ page, context }) => {
  await fakeImages(page)
  await createCollection(page, unique('Viewer'))
  await addGame(page, 385761)
  await addGame(page, 295947)
  await page.getByRole('button', { name: /faraway/i }).first().click()
  await open(page, 'Faraway')
  const dialog = viewer(page, 'Faraway')
  const cover = dialog.getByRole('img', { name: 'Faraway' })
  await expect(cover).toBeVisible()
  await expect(cover).toHaveAttribute('src', COVER)
  await expect(dialog).not.toContainText('1 / 1')
  await expect(dialog).toContainText('BoardGameGeek has no more images of this game.')
  await expect(dialog.getByRole('button', { name: /image$/ })).toHaveCount(0)
  await expectAccessible(page)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('dialog', { name: 'Faraway', exact: true }).getByRole('button', { name: 'Close' }).click()

  await context.setOffline(true)
  await page.getByRole('button', { name: /cascadia/i }).first().click()
  await open(page, 'Cascadia')
  await expect(viewer(page, 'Cascadia').getByRole('img', { name: 'Cascadia' })).toBeVisible()
  await expect(viewer(page, 'Cascadia')).toContainText('once you are back online')
  await expect(viewer(page, 'Cascadia')).not.toContainText(' / ')
  await context.setOffline(false)
})

test("US1: a BGG list's game sheet opens the same viewer (FR-001)", async ({ page }) => {
  await fakeImages(page)
  await page.route('**/api/bgg/lists/preview/9093?**', route =>
    route.fulfill({ json: fixture('api', `preview-9093-page-${new URL(route.request().url()).searchParams.get('page')}.json`) }),
  )
  await loadList(page, 'https://boardgamegeek.com/geekpreview/9093/spiel-essen-2026-preview')
  await page.getByRole('button', { name: 'Add Cascadia to a collection' }).click()
  await expect(page.getByRole('dialog', { name: 'Cascadia', exact: true })).toBeVisible()
  await open(page, 'Cascadia')
  const dialog = viewer(page, 'Cascadia')
  await expect(dialog).toContainText('1 / 8')
  await expect(dialog.getByRole('img', { name: 'Cascadia, image 1 of 8' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(dialog).toContainText('2 / 8')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Cascadia', exact: true })).toBeVisible()
})
