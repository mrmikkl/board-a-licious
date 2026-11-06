import { type SearchResult, rankResults } from '../../src/domain/bgg-search.ts'
import type { GameGallery } from '../../src/domain/gallery.ts'
import type { Offer } from '../../src/domain/offers.ts'
import type { PlayerVotes } from '../../src/domain/player-poll.ts'
import { getMarketOffers } from '../prices/bgg-market.ts'
import { BggError, type BggClient, TTL } from './cache.ts'
import type { BggSource, Game, ListEntry, ListKind, ListPage } from './source.ts'
import { asArray, decodeText, parseXml } from './xml.ts'

const BASE = 'https://boardgamegeek.com'
/** Ids per `thing` request (research R4). */
const BATCH = 20
/** Geeklist page size, as the website JSON pages them (research R6). */
const PER_PAGE = 25

type Value = { value?: string }
type Name = { type?: string; value?: string }
type Link = { type?: string; value?: string; inbound?: string }
type ThingItem = {
  type?: string
  id?: string
  thumbnail?: string
  name?: Name[]
  description?: string
  yearpublished?: Value
  minplayers?: Value
  maxplayers?: Value
  link?: Link[]
  statistics?: { ratings?: { average?: Value; bayesaverage?: Value } }
  'poll-summary'?: PollSummary | PollSummary[]
  poll?: Poll | Poll[]
}
type Poll = { name?: string; totalvotes?: string; results?: PollResults | PollResults[] }
type PollResults = { numplayers?: string; result?: { value?: string; numvotes?: string } | { value?: string; numvotes?: string }[] }
type PollSummary = { name?: string; result?: { name?: string; value?: string } | { name?: string; value?: string }[] }
type SearchItem = { type?: string; id?: string; name?: Name[]; yearpublished?: Value }
type GeeklistItem = { objecttype?: string; subtype?: string; objectid?: string; objectname?: string }

const KINDS: Record<string, Game['kind']> = { boardgame: 'boardgame', boardgameexpansion: 'expansion' }

const positive = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
/** "0", missing or negative means none; two decimals as stored (feature 005 R1). */
const rating = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}
const primaryName = (names: Name[] | undefined) => decodeText((names?.find(n => n.type === 'primary') ?? names?.[0])?.value)
const linked = (links: Link[] | undefined, type: string) => [
  ...new Set((links ?? []).filter(l => l.type === type && l.inbound !== 'true').map(l => decodeText(l.value)).filter(Boolean)),
]

/** "Best with 2–3 players" → "2–3 players"; empty when nobody voted. */
function pollSummary(item: ThingItem): { bestWith: string | null; recommendedWith: string | null } {
  const summary = asArray(item['poll-summary']).find(p => p.name === 'suggested_numplayers')
  const results = asArray(summary?.result)
  // BGG spells the second one "recommmendedwith" (three m)
  const text = (name: RegExp, prefix: RegExp) => {
    const value = decodeText(results.find(r => name.test(r.name ?? ''))?.value).replace(prefix, '')
    // empty or "(no votes)" when nobody voted
    return /\d/.test(value) ? value : null
  }
  return { bestWith: text(/^bestwith$/, /^best with\s+/i), recommendedWith: text(/^recom+endedwith$/, /^recommended with\s+/i) }
}

/** FR-006b: the votes per player count of the "suggested number of players" poll, and how many voted. */
function playerPoll(item: ThingItem): { playerPoll: PlayerVotes[]; playerPollVoters: number } {
  const poll = asArray(item.poll).find(p => p.name === 'suggested_numplayers')
  const rows = asArray(poll?.results).flatMap(r => {
    const votes = (value: string) => Number(asArray(r.result).find(x => x.value === value)?.numvotes) || 0
    const row = { players: r.numplayers ?? '', best: votes('Best'), recommended: votes('Recommended'), notRecommended: votes('Not Recommended') }
    // a player count nobody voted on says nothing
    return row.players && row.best + row.recommended + row.notRecommended > 0 ? [row] : []
  })
  return { playerPoll: rows, playerPollVoters: Number(poll?.totalvotes) || 0 }
}

function toGame(item: ThingItem, kind: Game['kind']): Game {
  const ratings = item.statistics?.ratings
  return {
    bggId: Number(item.id),
    name: primaryName(item.name),
    year: positive(item.yearpublished?.value),
    thumbnailUrl: decodeText(item.thumbnail) || null,
    description: decodeText(item.description) || null,
    kind,
    minPlayers: positive(item.minplayers?.value),
    maxPlayers: positive(item.maxplayers?.value),
    designers: linked(item.link, 'boardgamedesigner'),
    mechanisms: linked(item.link, 'boardgamemechanic'),
    publisher: linked(item.link, 'boardgamepublisher')[0] ?? null,
    rating: rating(ratings?.average?.value),
    geekRating: rating(ratings?.bayesaverage?.value),
    ...pollSummary(item),
    ...playerPoll(item),
  }
}

const read = (text: string): Record<string, unknown> => {
  try {
    return parseXml(text)
  } catch {
    throw new BggError('bgg_unavailable', 'BoardGameGeek sent something unexpected.')
  }
}

/**
 * F006: BoardGameGeek's official XML API with the token (ADR 0007): game details with ratings, search
 * and geeklists. Previews, companies and galleries are not offered there and stay on GeekdoSource.
 */
export class OfficialSource implements BggSource {
  /** two `thing` requests of 20 games */
  readonly fetchLimit = 2 * BATCH

  constructor(private readonly client: BggClient) {}

  async getGames(ids: number[]): Promise<Game[]> {
    const games: Game[] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const doc = read(await this.client.getXml(`${BASE}/xmlapi2/thing?id=${batch.join(',')}&stats=1`, TTL.game))
      const items = asArray((doc.items as { item?: ThingItem[] } | undefined)?.item)
      for (const item of items) {
        // `thing` answers any item type for an id (research R4): only board games and expansions count
        const kind = KINDS[item.type ?? '']
        if (kind && positive(item.id) && primaryName(item.name)) games.push(toGame(item, kind))
      }
    }
    return games
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const key = query.trim().replace(/\s+/g, ' ').toLowerCase()
    const url = `${BASE}/xmlapi2/search?query=${encodeURIComponent(key)}&type=boardgame,boardgameexpansion`
    const doc = read(await this.client.getXml(url, TTL.search))
    const byId = new Map<number, SearchResult>()
    for (const item of asArray((doc.items as { item?: SearchItem[] } | undefined)?.item)) {
      const bggId = positive(item.id)
      const kind = KINDS[item.type ?? '']
      const name = primaryName(item.name)
      if (!bggId || !kind || !name) continue
      // an expansion is listed twice, as boardgame and as boardgameexpansion (research R5)
      const known = byId.get(bggId)
      if (!known || kind === 'expansion') byId.set(bggId, { bggId, name, year: positive(item.yearpublished?.value), kind: known?.kind === 'expansion' ? 'expansion' : kind })
    }
    return rankResults([...byId.values()], key, limit)
  }

  async getListPage(kind: ListKind, id: number, page: number): Promise<ListPage> {
    if (kind !== 'geeklist') throw new BggError('bgg_unavailable', 'The official API has no previews.')
    const doc = read(await this.client.getXml(`${BASE}/xmlapi/geeklist/${id}`, TTL.list))
    const list = doc.geeklist as { title?: string; item?: GeeklistItem[] } | undefined
    if (!list) throw new BggError('not_found', 'BoardGameGeek has no such list.')
    const items = asArray(list.item)
    const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE))
    const entries: ListEntry[] = []
    items.slice((page - 1) * PER_PAGE, page * PER_PAGE).forEach((item, i) => {
      // geeklists also hold threads, other geeklists, RPGs and video games: only board games count
      const bggId = positive(item.objectid)
      if (item.objecttype !== 'thing' || !KINDS[item.subtype ?? ''] || !bggId) return
      entries.push({ position: (page - 1) * PER_PAGE + i + 1, bggId, name: decodeText(item.objectname), thumbnailUrl: null })
    })
    return { kind: 'geeklist', id, title: decodeText(list.title), page, pageCount, entries }
  }

  getMarketOffers(bggId: number, rates: Record<string, number>): Promise<Offer[]> {
    return getMarketOffers(this.client, bggId, rates)
  }

  async getCompanies(): Promise<{ id: number; name: string }[]> {
    throw new BggError('bgg_unavailable', 'The official API has no company lookup.')
  }

  async getGallery(): Promise<GameGallery> {
    throw new BggError('bgg_unavailable', 'The official API has no image gallery.')
  }
}
