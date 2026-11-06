import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createBggClient, memoryCache } from '../../worker/bgg/cache.ts'
import { GeekdoSource } from '../../worker/bgg/geekdo.ts'
import { OfficialSource } from '../../worker/bgg/official.ts'

const xmlFixture = (name: string) => readFileSync(new URL(`../fixtures/bgg-xml/${name}`, import.meta.url), 'utf8')
const jsonFixture = (name: string) => readFileSync(new URL(`../fixtures/bgg/${name}`, import.meta.url), 'utf8')

/** An official source over a fake BGG; `answer` gets the requested URL. */
function official(answer: (url: URL) => string | Response) {
  const calls: string[] = []
  let t = 0
  const client = createBggClient({
    fetch: async input => {
      const url = new URL(String(input))
      calls.push(`${url.pathname}${url.search}`)
      const body = answer(url)
      return typeof body === 'string' ? new Response(body, { headers: { 'Content-Type': 'text/xml' } }) : body
    },
    cache: memoryCache(() => t),
    now: () => t,
    sleep: async ms => void (t += ms),
    token: 'test-token',
    log: () => {},
  })
  return { source: new OfficialSource(client), calls }
}

const things = (url: URL) => (url.searchParams.get('id') === '477191' ? xmlFixture('thing-477191.xml') : xmlFixture('thing-295947-385318.xml'))

describe('OfficialSource.getGames (F006 research R4)', () => {
  it('maps a game and an expansion and drops other item types', async () => {
    const { source } = official(things)
    const games = await source.getGames([295947, 385318, 374341])
    expect(games.map(g => [g.bggId, g.kind])).toEqual([
      [295947, 'boardgame'],
      [385318, 'expansion'],
    ])
    expect(games[0]).toMatchObject({
      name: 'Cascadia',
      year: 2021,
      thumbnailUrl: expect.stringContaining('cf.geekdo-images.com'),
      minPlayers: 1,
      maxPlayers: 4,
      designers: ['Randy Flynn'],
      rating: 7.88,
      geekRating: 7.73,
    })
    expect(games[0]?.mechanisms).toEqual(expect.arrayContaining(['Hexagon Grid', 'Tile Placement']))
    expect(games[1]).toMatchObject({ name: 'Cascadia: Landmarks', rating: 7.73, geekRating: 6.84 })
  })

  it('reads the player poll summary: best with and recommended (F006)', async () => {
    const { source } = official(things)
    const [cascadia] = await source.getGames([295947])
    expect(cascadia).toMatchObject({ bestWith: '2–3 players', recommendedWith: '1–4 players' })
    expect(cascadia?.playerPoll).toEqual([
      { players: '1', best: 133, recommended: 439, notRecommended: 145 },
      { players: '2', best: 587, recommended: 334, notRecommended: 17 },
      { players: '3', best: 551, recommended: 324, notRecommended: 17 },
      { players: '4', best: 188, recommended: 552, notRecommended: 82 },
      { players: '4+', best: 2, recommended: 37, notRecommended: 455 },
    ])
    expect(cascadia?.playerPollVoters).toBe(1043)
    const [mini] = await source.getGames([477191])
    expect(mini).toMatchObject({ bestWith: null, recommendedWith: null, playerPoll: [], playerPollVoters: 0 })
  })

  it('decodes the full description, including entities BGG encodes twice', async () => {
    const { source } = official(things)
    const [cascadia] = await source.getGames([295947])
    expect(cascadia?.description).toMatch(/^Cascadia is a puzzly tile-laying/)
    expect(cascadia?.description).not.toMatch(/&[a-z#0-9]+;/i)
    expect(cascadia?.description).toContain('\n')
  })

  it('has no geek rating when BGG gives 0', async () => {
    const { source } = official(things)
    const [mini] = await source.getGames([477191])
    expect(mini).toMatchObject({ kind: 'expansion', rating: 8.19, geekRating: null, year: 2026, publisher: 'Flatout Games' })
  })

  it('asks for up to 20 games per request, with stats and the token, never for the website data', async () => {
    const { source, calls } = official(() => '<items/>')
    const ids = Array.from({ length: 41 }, (_, i) => 1000 + i)
    await source.getGames(ids)
    expect(calls).toHaveLength(3)
    expect(calls[0]).toBe(`/xmlapi2/thing?id=${ids.slice(0, 20).join(',')}&stats=1`)
    expect(calls.every(c => c.startsWith('/xmlapi2/thing?'))).toBe(true)
    expect(source.fetchLimit).toBe(40)
  })

  it('shows the same values as the website data for Cascadia, except the description (SC-004)', async () => {
    const { source } = official(things)
    let t = 0
    const web = new GeekdoSource({
      fetch: async input => {
        const url = new URL(String(input))
        return new Response(jsonFixture(url.pathname === '/api/dynamicinfo' ? 'dynamicinfo-295947.json' : 'geekitems-295947.json'))
      },
      cache: memoryCache(() => t),
      now: () => t,
      sleep: async ms => void (t += ms),
    })
    const [mine] = await source.getGames([295947])
    const [theirs] = await web.getGames([295947])
    const { description: _a, mechanisms: m1, publisher: _p1, bestWith: _w1, recommendedWith: _r1, playerPoll: _q1, playerPollVoters: _v1, ...a } = mine!
    const { description: _b, mechanisms: m2, publisher: _p2, bestWith: _w2, recommendedWith: _r2, playerPoll: _q2, playerPollVoters: _v2, ...b } = theirs!
    expect(a).toEqual({ ...b, thumbnailUrl: a.thumbnailUrl })
    expect(new Set(m1)).toEqual(new Set(m2))
  })
})

describe('OfficialSource.getListPage for geeklists (F006 research R6)', () => {
  it('reads the whole list once and serves pages of 25 with board games only', async () => {
    const { source, calls } = official(() => xmlFixture('geeklist-66420.xml'))
    const first = await source.getListPage('geeklist', 66420, 1)
    const second = await source.getListPage('geeklist', 66420, 2)
    expect(calls).toEqual(['/xmlapi/geeklist/66420'])
    expect(first).toMatchObject({ kind: 'geeklist', id: 66420, title: 'MetaList for GeekList AUCTIONS', page: 1, pageCount: 2 })
    const all = [...first.entries, ...second.entries]
    expect(all.length).toBe(4)
    expect(all.every(e => e.thumbnailUrl === null && e.bggId > 0 && e.name !== '')).toBe(true)
    expect(all.some(e => e.name === 'The 7th Continent' && e.bggId === 180263)).toBe(true)
    expect([...all.map(e => e.position)].sort((x, y) => x - y)).toEqual(all.map(e => e.position))
    expect(second.entries.every(e => e.position > 25)).toBe(true)
  })

  it('waits for a queued list (202) and then reads it', async () => {
    let n = 0
    const { source } = official(() => (++n === 1 ? new Response(xmlFixture('geeklist-202.xml'), { status: 202 }) : xmlFixture('geeklist-66420.xml')))
    const page = await source.getListPage('geeklist', 66420, 1)
    expect(page.title).toBe('MetaList for GeekList AUCTIONS')
  })

  it('reports a list BGG does not know as not found', async () => {
    const { source } = official(() => '<?xml version="1.0" encoding="utf-8"?><error message="Geeklist not found"/>')
    await expect(source.getListPage('geeklist', 1, 1)).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('OfficialSource.search (F006 research R5)', () => {
  it('asks for board games and expansions by the normalised text', async () => {
    const { source, calls } = official(() => xmlFixture('search-cascad.xml'))
    await source.search('  Cascad ', 50)
    expect(calls).toEqual(['/xmlapi2/search?query=cascad&type=boardgame,boardgameexpansion'])
  })

  it('merges the double listing of expansions and ranks the results', async () => {
    const { source } = official(() => xmlFixture('search-cascad.xml'))
    const results = await source.search('cascad', 50)
    expect(results).toHaveLength(25)
    expect(new Set(results.map(r => r.bggId)).size).toBe(25)
    expect(results.find(r => r.bggId === 385318)).toEqual({ bggId: 385318, name: 'Cascadia: Landmarks', year: 2023, kind: 'expansion' })
    expect(results.find(r => r.bggId === 295947)).toMatchObject({ kind: 'boardgame', year: 2021 })
    expect(results.slice(0, 2).map(r => r.name)).toEqual(['Cascade', 'Cascade'])
    expect(results.at(-1)?.name).not.toMatch(/^cascad/i)
  })

  it('decodes names and keeps an alternate name when BGG gives no primary one', async () => {
    const { source } = official(() => xmlFixture('search-cascad.xml'))
    const results = await source.search('cascad', 50)
    expect(results.find(r => r.bggId === 154301)?.name).toBe("The Battle at Kemble's Cascade")
    expect(results.find(r => r.bggId === 388406)?.name).toBe('Cascade')
  })

  it('answers the same search within a day from the cache', async () => {
    const { source, calls } = official(() => xmlFixture('search-cascad.xml'))
    await source.search('cascad', 50)
    await source.search('CASCAD', 8)
    expect(calls).toHaveLength(1)
  })

  it('has no results when BGG has none', async () => {
    const { source } = official(() => '<?xml version="1.0" encoding="utf-8"?><items total="0" termsofuse="x"></items>')
    expect(await source.search('zzzq', 50)).toEqual([])
  })
})
