import { type Page, expect, test } from '@playwright/test'

import { createCollection, expectAccessible, fakeBgg, unique } from './helpers.ts'

/**
 * F003 US3 (FR-015–FR-016): a collection's actions sit in the action bar (Add game · ♥ · Filter),
 * editing hides behind the pencil after the name, a long name runs as a ticker.
 * F003 US4 (FR-017–FR-018a): group order, the separator between the parts, folding.
 */

const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'
const ARK_NOVA = 'https://boardgamegeek.com/boardgame/342942/ark-nova'
const WINGSPAN = 'https://boardgamegeek.com/boardgame/266192/wingspan'

const actions = (page: Page) => page.getByRole('navigation', { name: 'Actions' })
const addGameButton = (page: Page) => actions(page).getByRole('button', { name: /^add game$/i })
const filterButton = (page: Page) => actions(page).getByRole('button', { name: /^filter/i })

async function addGame(page: Page, link: string, game: string) {
  await addGameButton(page).click()
  const sheet = page.getByRole('dialog', { name: 'Add game' })
  await sheet.getByLabel(/boardgamegeek link/i).fill(link)
  await expect(sheet.getByLabel(/^name$/i)).toHaveValue(game)
  await sheet.getByRole('button', { name: 'Add to collection' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: new RegExp(game, 'i') })).toBeVisible()
}

/** Opens the game from its group and picks a mark; picking closes the sheet. */
async function markAs(page: Page, group: RegExp, game: string, mark: RegExp) {
  await page.getByRole('region', { name: group }).getByRole('button', { name: new RegExp(game, 'i') }).click()
  await page.getByRole('dialog').getByRole('button', { name: mark }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('US3: Add game, ♥ and Filter at the bottom; nothing at the top but the name and the pencil', async ({ page }) => {
  await fakeBgg(page)
  const name = unique('Bottom')
  await createCollection(page, name)

  // an empty collection: the empty state explains the heart and Add game, the same action bar is there
  const empty = page.locator('main .empty')
  await expect(empty.getByRole('heading', { name: `No games in ${name} yet` })).toBeVisible()
  await expect(empty).toContainText(/heart/i)
  await expect(empty).toContainText(/add game/i)
  await expect(empty.getByRole('button')).toHaveCount(0)
  const controls = actions(page).locator('a, button')
  await expect(controls).toHaveText(['Add game', '', 'Filter', 'Show-off'])
  await expect(controls.nth(1)).toHaveAccessibleName('BG-Tinder: swipe a BGG list into this collection')
  await expect(controls.nth(1)).toHaveClass(/main-btn/)
  await expect(controls.first()).toHaveAccessibleName('Add game')
  await expect(controls.first().locator('svg')).toBeVisible()

  // the top: no tool row, no options, no back button; the name with the pencil
  await expect(page.locator('.collection-tools')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Collection options' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible()
  await expectAccessible(page)

  // Add game (plus) opens the Add game sheet
  await addGame(page, CASCADIA, 'Cascadia')
  await expect(controls).toHaveText(['Add game', '', 'Filter', 'Show-off'])
  await expect(page.locator('.collection-tools')).toHaveCount(0)
  await expect(empty).toHaveCount(0)

  // Filter opens Filter and group; narrowed: the name says so, the summary line stays above the games
  await expect(filterButton(page)).toHaveAccessibleName('Filter')
  await expect(page.locator('.filter-summary')).toHaveCount(0)
  await filterButton(page).click()
  const filter = page.getByRole('dialog', { name: 'Filter and group' })
  await expect(filter).toBeVisible()
  await filter.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'Not bought' }).click()
  await filter.getByRole('button', { name: 'Done' }).click()
  await expect(filter).toBeHidden()
  await expect(filterButton(page)).toHaveAccessibleName('Filter (active)')
  const summary = page.locator('.filter-summary')
  await expect(summary).toContainText('1 game')
  const summaryBox = (await summary.boundingBox())!
  const gameBox = (await page.getByRole('button', { name: /cascadia/i }).boundingBox())!
  expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(gameBox.y)
  await summary.click()
  await expect(filter).toBeVisible()
  await filter.getByRole('group', { name: 'Bought' }).getByRole('button', { name: 'All' }).click()
  await filter.getByRole('button', { name: 'Done' }).click()
  await expect(filterButton(page)).toHaveAccessibleName('Filter')
  await expectAccessible(page)
})

test('US3: the pencil opens Edit collection: Save name renames, Delete collection… asks and deletes', async ({ page }) => {
  const name = unique('Pencil')
  await createCollection(page, name)
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  const edit = page.getByRole('dialog', { name: 'Edit collection' })
  await expect(edit).toBeVisible()
  await expect(edit.getByLabel('Name')).toHaveValue(name)
  await expect(edit.getByRole('button', { name: 'Save name' })).toBeDisabled()
  await expectAccessible(page)
  const renamed = `${name} renamed`
  await edit.getByLabel('Name').fill(renamed)
  await edit.getByRole('button', { name: 'Save name' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('status')).toContainText(`Renamed to ${renamed}`)
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${renamed}` })).toBeVisible()

  // Cancel changes nothing
  await page.getByRole('button', { name: `Edit ${renamed}` }).click()
  await edit.getByRole('button', { name: 'Cancel' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible()

  // Delete collection… asks first
  await page.getByRole('button', { name: `Edit ${renamed}` }).click()
  await edit.getByRole('button', { name: 'Delete collection…' }).click()
  const ask = page.getByRole('dialog', { name: `Delete ${renamed} and its 0 games?` })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible()
  await page.getByRole('button', { name: `Edit ${renamed}` }).click()
  await edit.getByRole('button', { name: 'Delete collection…' }).click()
  await ask.getByRole('button', { name: 'Delete collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(renamed) })).toHaveCount(0)
})

test('US3: a long name runs as a ticker before the pencil; with reduced motion it ends in "…"', async ({ page }, testInfo) => {
  const name = `${unique('Ticker')} SPIEL Essen 2026 Must Haves and Maybes`.padEnd(60, 'x').slice(0, 60)
  expect(name).toHaveLength(60)
  await createCollection(page, name)
  const heading = page.getByRole('heading', { level: 1, name })
  const pencil = page.getByRole('button', { name: `Edit ${name}` })
  await expect(heading).toHaveClass(/is-long/)
  await expect(pencil).toBeVisible()
  // the pencil stays inside the screen, right of the name
  const headingBox = (await heading.boundingBox())!
  const pencilBox = (await pencil.boundingBox())!
  expect(pencilBox.x + pencilBox.width).toBeLessThanOrEqual(360)
  expect(pencilBox.x).toBeGreaterThanOrEqual(headingBox.x + headingBox.width - 1)
  const text = heading.locator('span')
  if (testInfo.project.name === 'phone-reduced-motion') {
    await expect(text).toHaveCSS('animation-name', 'none')
    await expect(heading).toHaveCSS('text-overflow', 'ellipsis')
  } else {
    await expect(text).toHaveCSS('animation-name', 'ticker')
    await expect
      .poll(() => text.evaluate(el => el.getAnimations().some(a => a.playState === 'running')))
      .toBe(true)
  }
  // a short name stands still
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  const edit = page.getByRole('dialog', { name: 'Edit collection' })
  const short = unique('Short')
  await edit.getByLabel('Name').fill(short)
  await edit.getByRole('button', { name: 'Save name' }).click()
  const shortHeading = page.getByRole('heading', { level: 1, name: short })
  await expect(shortHeading).toBeVisible()
  await expect(shortHeading).not.toHaveClass(/is-long/)
  await expectAccessible(page)
})

test('US4: groups in the collection order, one separator between the parts, Not yet marked and Not interested fold', async ({ page }) => {
  await fakeBgg(page)
  const name = unique('Groups')
  await createCollection(page, name)
  await addGame(page, CASCADIA, 'Cascadia')
  await addGame(page, ARK_NOVA, 'Ark Nova')
  await addGame(page, WINGSPAN, 'Wingspan')
  const headings = page.locator('main .group-title')
  // the counts roll for 650 ms after each mark; give them room under the load of a full run
  const slow = expect.configure({ timeout: 15_000 })
  const separators = page.locator('main hr.separator')

  // only Not yet marked: no line between the parts (only the one under the heading)
  await slow(headings).toHaveText([/no category yet3/i])
  await expect(separators).toHaveCount(1)

  // Not interested starts collapsed, below Not yet marked; now both parts are "rest": still one line
  await markAs(page, /no category yet/i, 'Wingspan', /not interested/i)
  await slow(headings).toHaveText([/no category yet2/i, /not interested1/i])
  await expect(separators).toHaveCount(1)
  const skipFold = page.getByRole('region', { name: /not interested/i }).getByRole('button', { name: /not interested/i })
  await expect(skipFold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /wingspan/i })).toBeHidden()

  // marked games above the line, Not yet marked and Not interested below it
  await markAs(page, /no category yet/i, 'Ark Nova', /must have/i)
  await slow(headings).toHaveText([/must have1/i, /no category yet1/i, /not interested1/i])
  await expect(separators).toHaveCount(2)
  const lineBox = (await separators.nth(1).boundingBox())!
  const mustHaveBox = (await headings.nth(0).boundingBox())!
  const newBox = (await headings.nth(1).boundingBox())!
  expect(lineBox.y).toBeGreaterThan(mustHaveBox.y)
  expect(lineBox.y).toBeLessThan(newBox.y)
  await markAs(page, /no category yet/i, 'Cascadia', /unsure/i)
  await slow(headings).toHaveText([/must have1/i, /unsure1/i, /not interested1/i])
  await expect(separators).toHaveCount(2)
  await markAs(page, /unsure/i, 'Cascadia', /^(👀 )?interested/i)
  await slow(headings).toHaveText([/must have1/i, /interested1/i, /not interested1/i])

  // every game marked, none left: the parts are marked and Not interested
  await markAs(page, /^interested/i, 'Cascadia', /poop/i)
  await slow(headings).toHaveText([/must have1/i, /poop1/i, /not interested1/i])
  await expect(separators).toHaveCount(2)

  // all marked games gone from the rest: one part only, no second line
  await skipFold.click()
  await expect(skipFold).toHaveAttribute('aria-expanded', 'true')
  await markAs(page, /not interested/i, 'Wingspan', /mark as not yet decided/i)
  await slow(headings).toHaveText([/must have1/i, /poop1/i, /no category yet1/i])
  await expect(separators).toHaveCount(2)

  // Not yet marked is a fold button, open on arrival; folding keeps the count visible
  const newFold = page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: /no category yet/i })
  await expect(newFold).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /wingspan/i })).toBeVisible()
  await newFold.click()
  await expect(newFold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /wingspan/i })).toBeHidden()
  await expect(newFold).toContainText('1')
  await expect(newFold).toBeVisible()
  await newFold.click()
  await expect(newFold).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /wingspan/i })).toBeVisible()
  await expectAccessible(page)

  // not remembered: after a reload Not yet marked is open again
  await newFold.click()
  await expect(newFold).toHaveAttribute('aria-expanded', 'false')
  await page.reload()
  await expect(page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: /no category yet/i })).toHaveAttribute('aria-expanded', 'true')

  // the order of marks elsewhere is unchanged: the filter's groups and the game's picker
  await filterButton(page).click()
  const filter = page.getByRole('dialog', { name: 'Filter and group' })
  await expect(filter.getByRole('checkbox')).toHaveCount(7)
  await expect(filter.getByRole('checkbox').first()).toHaveAccessibleName(/no category yet/i)
  await expect(filter.getByRole('checkbox').last()).toHaveAccessibleName(/not interested/i)
  await page.keyboard.press('Escape')
  await expect(filter).toBeHidden()
  await page.getByRole('region', { name: /no category yet/i }).getByRole('button', { name: /wingspan/i }).click()
  await expect(page.getByRole('dialog').getByRole('group', { name: 'Mark as' }).getByRole('button')).toHaveText([/must have/i, /interested/i, /unsure/i, /for later/i, /poop/i])
})
