import { describe, expect, it } from 'vitest'

import {
  type Backup,
  backupFileName,
  exportBackup,
  parseBackup,
  planImport,
} from '../../src/domain/backup.ts'
import { type Collection, type Entry, newEntry } from '../../src/domain/collection.ts'

const T1 = '2026-10-16T09:00:00.000Z'
const T2 = '2026-10-17T09:30:00.000Z'
const NOW = '2026-10-18T12:00:00.000Z'

const essen: Collection = { id: 'c1', name: 'Essen 2026', updatedAt: T1, deleted: false }
const wishlist: Collection = { id: 'c2', name: 'Wishlist', updatedAt: T1, deleted: false }
const gone: Collection = { id: 'c3', name: 'Old', updatedAt: T1, deleted: true }

const entry = (collectionId: string, bggId: number, patch: Partial<Entry> = {}): Entry => ({
  ...newEntry(collectionId, bggId, T1),
  ...patch,
})

const bought = entry('c1', 446453, {
    mark: 'must_have',
    bought: true,
    paidCents: 5200,
    paidCurrency: 'EUR',
    facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Example Press' },
    factsSource: 'preview',
})
const harmonies = entry('c1', 414317, { mark: 'interested' })
const cascadia = entry('c2', 295947, {
  mark: 'unsure',
  facts: { booth: null, priceCents: null, currency: null, publisher: null },
  factsSource: 'manual',
})
const entries: Entry[] = [bought, harmonies, entry('c1', 1, { mark: 'poop', deleted: true }), cascadia, entry('c3', 2, { deleted: true })]

const games = new Map([
  [446453, { name: 'Example Game', year: 2026 }],
  [414317, { name: 'Harmonies', year: 2024 }],
  [295947, { name: 'Cascadia', year: 2021 }],
])

const ids = () => {
  let n = 0
  return () => `new-${++n}`
}

const empty = { collections: [] as Collection[], entries: [] as Entry[] }

const parsed = (data: unknown): Backup => {
  const result = parseBackup(JSON.stringify(data))
  if (!result.ok) throw new Error(result.error)
  return result.backup
}

const fileV2 = () => JSON.parse(JSON.stringify(exportBackup({ collections: [essen, wishlist, gone], entries, games, now: T2 })))

describe('backup export', () => {
  it('names the file by date', () => {
    expect(backupFileName(T2)).toBe('board-a-licious-backup-2026-10-17.json')
  })

  it('writes version 3 with active rows only', () => {
    const file = exportBackup({ collections: [essen, wishlist, gone], entries, games, now: T2 })
    expect(file).toEqual({
      format: 'board-a-licious-backup',
      version: 3,
      exportedAt: T2,
      collections: [
        {
          id: 'c1',
          name: 'Essen 2026',
          updatedAt: T1,
          entries: [
            {
              bggId: 446453,
              name: 'Example Game',
              year: 2026,
              mark: 'must_have',
              bought: true,
              paidCents: 5200,
              paidCurrency: 'EUR',
              facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Example Press' },
              factsSource: 'preview',
              updatedAt: T1,
            },
            {
              bggId: 414317,
              name: 'Harmonies',
              year: 2024,
              mark: 'interested',
              bought: false,
              paidCents: null,
              paidCurrency: null,
              facts: null,
              factsSource: null,
              updatedAt: T1,
            },
          ],
        },
        {
          id: 'c2',
          name: 'Wishlist',
          updatedAt: T1,
          entries: [expect.objectContaining({ bggId: 295947, name: 'Cascadia', mark: 'unsure' })],
        },
      ],
    })
  })

  it('writes null name and year for games missing from the lookup', () => {
    const file = exportBackup({ collections: [essen], entries: [entry('c1', 7)], games: new Map(), now: T2 })
    expect(file.collections[0]?.entries[0]).toMatchObject({ bggId: 7, name: null, year: null })
  })
})

describe('backup round trip (version 2)', () => {
  it('restores every collection and entry into an empty device, with a fresh updatedAt', () => {
    const backup = parsed(fileV2())
    const plan = planImport({ current: empty, backup, resolution: 'keep', now: NOW, newId: ids() })
    expect(plan.conflicts).toEqual([])
    expect(plan.collections).toEqual([
      { ...essen, updatedAt: NOW },
      { ...wishlist, updatedAt: NOW },
    ])
    const active = entries.filter(e => !e.deleted).map(e => ({ ...e, updatedAt: NOW }))
    expect(plan.entries).toEqual(active)
    expect(plan.games).toEqual(games)
  })

  it('brings back a deleted collection unchanged', () => {
    const backup = parsed(fileV2())
    const current = {
      collections: [{ ...essen, deleted: true, updatedAt: T2 }, wishlist],
      entries: entries.map(e => (e.collectionId === 'c1' ? { ...e, deleted: true, updatedAt: T2 } : e)),
    }
    const plan = planImport({ current, backup, resolution: 'keep', now: NOW, newId: ids() })
    expect(plan.conflicts).toEqual([])
    expect(plan.collections).toEqual([{ ...essen, updatedAt: NOW }])
    expect(plan.entries).toEqual(entries.filter(e => e.collectionId === 'c1' && !e.deleted).map(e => ({ ...e, updatedAt: NOW })))
  })

  it('changes nothing when the device already has the same data', () => {
    const backup = parsed(fileV2())
    const plan = planImport({ current: { collections: [essen, wishlist], entries }, backup, resolution: 'backup', now: NOW, newId: ids() })
    expect(plan).toMatchObject({ collections: [], entries: [], conflicts: [] })
  })
})

describe('backup conflicts', () => {
  const current = {
    collections: [{ ...essen, name: 'Essen!', updatedAt: T2 }, wishlist],
    entries: [
      { ...bought, mark: 'interested' as const, bought: false, paidCents: null, paidCurrency: null, updatedAt: T2 },
      harmonies,
      entry('c1', 555, { mark: 'unsure' }),
    ],
  }

  it('reports conflicts for changed collections and entries, and adds what is missing', () => {
    const plan = planImport({ current, backup: parsed(fileV2()), resolution: 'keep', now: NOW, newId: ids() })
    expect(plan.conflicts).toEqual([
      { collectionId: 'c1', bggId: null },
      { collectionId: 'c1', bggId: 446453 },
    ])
    expect(plan.collections).toEqual([])
    expect(plan.entries).toEqual([{ ...cascadia, updatedAt: NOW }])
  })

  it('"Use backup" writes the backup rows with a fresh updatedAt', () => {
    const plan = planImport({ current, backup: parsed(fileV2()), resolution: 'backup', now: NOW, newId: ids() })
    expect(plan.collections).toEqual([{ ...essen, updatedAt: NOW }])
    expect(plan.entries).toEqual([
      { ...bought, updatedAt: NOW },
      { ...cascadia, updatedAt: NOW },
    ])
  })

  it('never removes entries that are only on the device', () => {
    const plan = planImport({ current, backup: parsed(fileV2()), resolution: 'backup', now: NOW, newId: ids() })
    expect(plan.entries.find(e => e.bggId === 555)).toBeUndefined()
  })
})

describe('backup version 1', () => {
  const v1 = {
    format: 'board-a-licious-backup',
    version: 1,
    exportedAt: T1,
    entries: [
      { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: 'https://cf.geekdo-images.com/x.jpg', state: 'must_have', updatedAt: T1 },
      { bggId: 414317, name: 'Harmonies', year: 2024, thumbnailUrl: null, state: 'poop', updatedAt: T1 },
    ],
  }

  it('imports a version 1 file as one standard collection named "Imported"', () => {
    const plan = planImport({ current: empty, backup: parsed(v1), resolution: 'keep', now: NOW, newId: ids() })
    expect(plan.collections).toEqual([{ id: 'new-1', name: 'Imported', updatedAt: NOW, deleted: false }])
    expect(plan.entries).toEqual([
      { ...newEntry('new-1', 295947, NOW), mark: 'must_have' },
      { ...newEntry('new-1', 414317, NOW), mark: 'poop' },
    ])
    expect(plan.games.get(295947)).toEqual({ name: 'Cascadia', year: 2021 })
  })

  it('imports into the existing "Imported" collection a second time', () => {
    const imported: Collection = { id: 'imp', name: 'Imported', updatedAt: T2, deleted: false }
    const current = { collections: [imported], entries: [entry('imp', 295947, { mark: 'interested' })] }
    const plan = planImport({ current, backup: parsed(v1), resolution: 'keep', now: NOW, newId: ids() })
    expect(plan.collections).toEqual([])
    expect(plan.conflicts).toEqual([{ collectionId: 'imp', bggId: 295947 }])
    expect(plan.entries).toEqual([{ ...newEntry('imp', 414317, NOW), mark: 'poop' }])
  })
})

describe('invalid backup files', () => {
  const reject = (text: string) => {
    const result = parseBackup(text)
    if (result.ok) throw new Error('expected the file to be rejected')
    return result.error
  }
  const withFirstEntry = (patch: Record<string, unknown>) => {
    const file = fileV2()
    Object.assign(file.collections[0].entries[0], patch)
    return JSON.stringify(file)
  }

  it('rejects text that is not JSON', () => {
    expect(reject('not json {')).toBe('This file is not a backup: it is not JSON.')
  })

  it('rejects other formats', () => {
    expect(reject('[]')).toBe('This file is not a Board-a-licious backup.')
    expect(reject(JSON.stringify({ format: 'something-else', version: 2 }))).toBe('This file is not a Board-a-licious backup.')
  })

  it('reads version 2 files, ignoring the collection type they had', () => {
    const v2 = fileV2()
    v2.version = 2
    for (const c of v2.collections) c.type = 'essen'
    const result = parseBackup(JSON.stringify(v2))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.collections.map(c => Object.keys(c).sort())).toEqual(v2.collections.map(() => ['entries', 'id', 'name']))
  })

  it('rejects newer versions', () => {
    expect(reject(JSON.stringify({ ...fileV2(), version: 4 }))).toBe(
      'This backup comes from a newer version of Board-a-licious (version 4).',
    )
    expect(reject(JSON.stringify({ ...fileV2(), version: 'two' }))).toBe('The backup version is missing or unknown.')
  })

  it('names the first invalid row', () => {
    expect(reject(withFirstEntry({ mark: 'loved' }))).toBe('Collection 1 ("Essen 2026"), game 1: Unknown mark "loved".')
    expect(reject(withFirstEntry({ bggId: -4 }))).toBe('Collection 1 ("Essen 2026"), game 1: bggId must be a positive whole number.')
    expect(reject(withFirstEntry({ paidCents: 12.5 }))).toBe(
      'Collection 1 ("Essen 2026"), game 1: The price paid must be a whole number of cents, 0 or more.',
    )
    expect(reject(withFirstEntry({ name: 42 }))).toBe('Collection 1 ("Essen 2026"), game 1: The game name must be text.')
    const file = fileV2()
    file.collections[1].name = ''
    expect(reject(JSON.stringify(file))).toBe('Collection 2 (""): The name must not be empty.')
  })

  it('rejects missing lists and duplicates', () => {
    expect(reject(JSON.stringify({ ...fileV2(), collections: null }))).toBe('The backup has no list of collections.')
    const noEntries = fileV2()
    delete noEntries.collections[0].entries
    expect(reject(JSON.stringify(noEntries))).toBe('Collection 1 ("Essen 2026"): The collection has no list of games.')
    const dupCollection = fileV2()
    dupCollection.collections[1].id = 'c1'
    expect(reject(JSON.stringify(dupCollection))).toBe('Collection 2 ("Wishlist"): The id "c1" is used twice.')
    const dupEntry = fileV2()
    dupEntry.collections[0].entries[1].bggId = 446453
    expect(reject(JSON.stringify(dupEntry))).toBe('Collection 1 ("Essen 2026"), game 2: The game 446453 is listed twice.')
  })

  it('rejects invalid version 1 rows', () => {
    const v1 = { format: 'board-a-licious-backup', version: 1, entries: [{ bggId: 1, state: 'loved', updatedAt: T1 }] }
    expect(reject(JSON.stringify(v1))).toBe('Game 1: Unknown mark "loved".')
    expect(reject(JSON.stringify({ ...v1, entries: undefined }))).toBe('The backup has no list of games.')
  })
})
