import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { BggError, TTL, createBggClient, memoryCache } from '../../worker/bgg/cache.ts'
import { GeekdoSource } from '../../worker/bgg/geekdo.ts'
import { OfficialSource } from '../../worker/bgg/official.ts'

const xmlFixture = (name: string) => readFileSync(new URL(`../fixtures/bgg-xml/${name}`, import.meta.url), 'utf8')

const NONE = { own: false, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null }

/** An official source over a fake BGG; `answer` gets the requested URL. The clock can be moved on. */
function official(answer: (url: URL) => string | Response) {
  const calls: { url: string; authorization: string | null }[] = []
  let t = 0
  const client = createBggClient({
    fetch: async (input, init) => {
      const url = new URL(String(input))
      calls.push({ url: url.href, authorization: new Headers(init?.headers).get('Authorization') })
      const body = answer(url)
      return typeof body === 'string' ? new Response(body, { headers: { 'Content-Type': 'text/xml' } }) : body
    },
    cache: memoryCache(() => t),
    now: () => t,
    sleep: async ms => void (t += ms),
    token: 'test-token',
    log: () => {},
  })
  return { source: new OfficialSource(client), calls, advance: (ms: number) => void (t += ms) }
}

const recorded = (url: URL) =>
  url.searchParams.get('subtype') === 'boardgameexpansion' ? xmlFixture('collection-expansions.xml') : xmlFixture('collection-games.xml')

const item = (attrs: string, status: string, name = 'Hand made') =>
  `<item objecttype="thing" objectid="${attrs}" subtype="boardgame" collid="1"><name sortindex="1">${name}</name><status ${status} lastmodified="2026-01-01 00:00:00" /></item>`
const items = (...rows: string[]) => `<?xml version="1.0" encoding="utf-8"?><items totalitems="${rows.length}">${rows.join('')}</items>`
const empty = items()

describe('OfficialSource.getCollection (F008 research R1)', () => {
  it('asks for games and expansions separately, with the token, username encoded and lower-cased', async () => {
    const { source, calls } = official(() => empty)
    await source.getCollection('Anna Meeple')
    expect(calls.map(c => c.url)).toEqual([
      'https://boardgamegeek.com/xmlapi2/collection?username=anna%20meeple&subtype=boardgame&excludesubtype=boardgameexpansion',
      'https://boardgamegeek.com/xmlapi2/collection?username=anna%20meeple&subtype=boardgameexpansion',
    ])
    expect(calls.every(c => c.authorization === 'Bearer test-token')).toBe(true)
  })

  it('maps the recorded collection: kind from the request, name decoded, year, thumbnail, statuses', async () => {
    const { source } = official(recorded)
    const collection = await source.getCollection('mrmikkl')
    // 17 game rows with one game twice, 10 expansion rows
    expect(collection).toHaveLength(16 + 10)
    expect(collection.find(i => i.bggId === 194789)).toEqual({
      bggId: 194789,
      name: "10 Minute Heist: The Wizard's Tower",
      year: 2017,
      thumbnailUrl: expect.stringMatching(/^https:\/\/cf\.geekdo-images\.com\/.+pic3584961\.jpg$/),
      kind: 'boardgame',
      status: NONE,
    })
    expect(collection.find(i => i.bggId === 400205)?.status).toEqual({ ...NONE, own: true })
    expect(collection.find(i => i.bggId === 68448)?.status).toEqual({ ...NONE, prevOwned: true })
    expect(collection.find(i => i.bggId === 356080)?.status).toEqual({ ...NONE, wantInTrade: true, wishlist: 1 })
    expect(collection.filter(i => i.kind === 'expansion')).toHaveLength(10)
    expect(collection.filter(i => i.kind === 'expansion').every(i => i.status.wishlist === null || i.status.wishlist === 5)).toBe(true)
  })

  it('merges copies of one game: a status counts if any copy has it', async () => {
    const { source } = official(recorded)
    const clank = (await source.getCollection('mrmikkl')).filter(i => i.bggId === 201808)
    expect(clank).toHaveLength(1)
    expect(clank[0]?.status).toEqual({ ...NONE, prevOwned: true })
  })

  it('maps every flag and keeps the lowest wishlist priority of the copies; an invalid priority counts as 3', async () => {
    const { source } = official(url =>
      url.searchParams.get('subtype') === 'boardgameexpansion'
        ? empty
        : items(
            item('1', 'own="0" prevowned="0" fortrade="1" want="0" wanttoplay="1" wanttobuy="1" wishlist="1" wishlistpriority="4" preordered="1"'),
            item('1', 'own="1" prevowned="0" fortrade="0" want="1" wanttoplay="0" wanttobuy="0" wishlist="1" wishlistpriority="2" preordered="0"'),
            item('2', 'own="0" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="1" wishlistpriority="9" preordered="0"'),
            item('3', 'own="0" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="1" preordered="0"'),
          ),
    )
    const [one, two, three] = await source.getCollection('anna')
    expect(one).toMatchObject({ bggId: 1, year: null, thumbnailUrl: null })
    expect(one?.status).toEqual({ own: true, prevOwned: false, forTrade: true, wantInTrade: true, wantToBuy: true, wantToPlay: true, preordered: true, wishlist: 2 })
    expect(two?.status.wishlist).toBe(3)
    expect(three?.status.wishlist).toBe(3)
  })

  it('skips items that are not things', async () => {
    const { source } = official(url =>
      url.searchParams.get('subtype') === 'boardgameexpansion'
        ? empty
        : items(item('1', 'own="1"'), item('2', 'own="1"').replace('objecttype="thing"', 'objecttype="family"')),
    )
    expect((await source.getCollection('anna')).map(i => i.bggId)).toEqual([1])
  })

  it('caches the answer 15 minutes per user; fresh skips the cache', async () => {
    expect(TTL.collection).toBe(900)
    const { source, calls, advance } = official(() => empty)
    await source.getCollection('anna')
    await source.getCollection('ANNA')
    expect(calls).toHaveLength(2)
    await source.getCollection('anna', { fresh: true })
    expect(calls).toHaveLength(4)
    advance(900_000)
    await source.getCollection('anna')
    expect(calls).toHaveLength(6)
  })

  it('answers bgg_preparing with a retry time when BGG still queues after the retries', async () => {
    const { source } = official(() => new Response(xmlFixture('collection-queued.xml'), { status: 202 }))
    const error = await source.getCollection('anna').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BggError)
    expect(error).toMatchObject({ code: 'bgg_preparing', retryAfter: expect.any(Number) })
    expect((error as BggError).retryAfter).toBeGreaterThan(0)
  })

  it('maps an unknown username to not_found', async () => {
    const { source } = official(() => xmlFixture('collection-unknown-user.xml'))
    await expect(source.getCollection('nobody_here')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('maps other BGG errors to bgg_unavailable', async () => {
    const { source } = official(() => '<errors><error><message>Something else</message></error></errors>')
    await expect(source.getCollection('anna')).rejects.toMatchObject({ code: 'bgg_unavailable' })
  })
})

describe('GeekdoSource.getCollection', () => {
  it('is unavailable: collections need the official API (constitution V)', async () => {
    const web = new GeekdoSource({ fetch: async () => new Response('{}'), cache: memoryCache() })
    await expect(web.getCollection('anna')).rejects.toMatchObject({ code: 'bgg_unavailable' })
  })
})
