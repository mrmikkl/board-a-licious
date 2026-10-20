import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

import { expectAccessible, fakeBgg, unique } from './helpers.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/api/${name}`, import.meta.url), 'utf8')

/** The backup fixture (version 2, with the old Essen type) as a fresh collection (own id and name, as the dev database is shared). */
function backupFile(name: string) {
  const id = crypto.randomUUID()
  const text = fixture('backup-v2.json').replace('COLLECTION_ID', id).replace('COLLECTION_NAME', name)
  return { id, file: { name: 'board-a-licious-backup-2026-10-17.json', mimeType: 'application/json', buffer: Buffer.from(text) } }
}

async function importFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import backup' }).click()
  await (await chooser).setFiles(file)
}

test('US5: share the Must Haves of an Essen collection as text', async ({ page }) => {
  await fakeBgg(page)
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown[] }
    w.shared = []
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: unknown) => void w.shared.push(data),
    })
  })
  await page.goto('/#/share')
  const name = unique('Essen 2026')
  await importFile(page, backupFile(name).file)
  await expect(page.getByRole('status')).toContainText(/imported/i)

  await page.getByLabel('Collection', { exact: true }).selectOption({ label: name })
  await expect(page.getByRole('checkbox', { name: /must have/i })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /^👀 interested/i })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /unsure/i })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /unsure/i })).toHaveAccessibleName(/1 game/)

  const expected = [
    `🎲 ${name}`,
    '',
    '⭐ Must Have (1)',
    '• ✅ Cascadia – 3-R400, €60 – https://boardgamegeek.com/boardgame/295947',
    '',
    '👀 Interested (1)',
    '• Harmonies – https://boardgamegeek.com/boardgame/414317',
  ].join('\n')
  await expect(page.getByRole('region', { name: 'Message preview' })).toHaveText(expected)
  await expectAccessible(page)

  await page.getByRole('button', { name: 'Share list' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared)).toEqual([{ text: expected }])

  // nothing chosen: no share button, and the screen says why
  await page.getByRole('checkbox', { name: /must have/i }).uncheck()
  await page.getByRole('checkbox', { name: /^👀 interested/i }).uncheck()
  await expect(page.getByText('Choose at least one group to share.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share list' })).toHaveCount(0)
})

test('US5: without a share menu the list is copied to the clipboard', async ({ page }) => {
  await fakeBgg(page)
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[] }
    w.copied = []
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void w.copied.push(text) },
    })
  })
  await page.goto('/#/share')
  const name = unique('Copy me')
  await importFile(page, backupFile(name).file)
  await page.getByLabel('Collection', { exact: true }).selectOption({ label: name })
  await page.getByRole('checkbox', { name: /unsure/i }).check()
  await expect(page.getByRole('region', { name: 'Message preview' })).toContainText('🤔 Unsure (1)')

  await page.getByRole('button', { name: 'Share list' }).click()
  await expect(page.getByRole('status')).toHaveText(/copied/i)
  const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied)
  expect(copied).toHaveLength(1)
  expect(copied[0]).toContain('• Fjord Fishers – https://boardgamegeek.com/boardgame/446453')
})

test('US5: export a backup, import it back over a changed mark, restore a deleted collection', async ({ page }) => {
  await fakeBgg(page)
  await page.goto('/#/share')
  const name = unique('Backup me')
  const { id, file } = backupFile(name)
  await importFile(page, file)
  await expect(page.getByRole('status')).toContainText(/imported/i)
  await expectAccessible(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const saved = await download
  expect(saved.suggestedFilename()).toMatch(/^board-a-licious-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const exported = JSON.parse(readFileSync(await saved.path(), 'utf8'))
  expect(exported).toMatchObject({ format: 'board-a-licious-backup', version: 3 })
  const mine = exported.collections.find((c: { id: string }) => c.id === id)
  expect(mine).toMatchObject({ name })
  expect(mine).not.toHaveProperty('type')
  expect(mine.entries).toHaveLength(3)
  expect(mine.entries.find((e: { bggId: number }) => e.bggId === 295947)).toMatchObject({
    name: 'Cascadia',
    mark: 'must_have',
    bought: true,
    paidCents: 5200,
    facts: { booth: '3-R400', priceCents: 6000 },
  })
  // other test runs share the account: import only this run's collection back
  const ownBackup = {
    name: saved.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...exported, collections: [mine] })),
  }

  // change a mark, then import: asked once, the backup wins
  await page.goto(`/#/collections/${id}`)
  await page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^(👀 )?interested/i }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: /^interested/i }).getByRole('button', { name: /cascadia/i })).toBeVisible()

  await page.goto('/#/share')
  await importFile(page, ownBackup)
  const ask = page.getByRole('dialog', { name: /1 game differs/i })
  await expect(ask.getByRole('button', { name: 'Keep current' })).toBeVisible()
  await expectAccessible(page)
  await ask.getByRole('button', { name: 'Use backup' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(`/#/collections/${id}`)
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toBeVisible()

  // delete the collection (F003: behind the pencil after its name), import: it is back without a question
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  await page.getByRole('button', { name: 'Delete collection…' }).click()
  await page.getByRole('button', { name: 'Delete collection' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Collections' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
  await page.goto('/#/share')
  await importFile(page, ownBackup)
  await expect(page.getByRole('status')).toContainText(/1 collection/i)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(`/#/collections/${id}`)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('region', { name: /must have/i }).getByRole('button', { name: /cascadia/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /unsure/i }).getByRole('button', { name: /fjord fishers/i })).toBeVisible()
})

test('US5: an invalid backup changes nothing and names the first problem', async ({ page }) => {
  await fakeBgg(page)
  await page.goto('/#/share')
  await importFile(page, {
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from(fixture('backup-invalid.json')),
  })
  await expect(page.getByRole('alert')).toContainText('Collection 1 ("Broken backup"), game 2: Unknown mark "great".')
  await expect(page.getByRole('alert')).toContainText('Nothing was changed.')
  await expect(page.getByRole('option', { name: 'Broken backup' })).toHaveCount(0)
  await expectAccessible(page)
})
