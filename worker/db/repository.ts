import type { Collection, Entry } from '../../src/domain/collection.ts'
import type { GameDetails } from '../../src/domain/game-info.ts'
import type { PlayerVotes } from '../../src/domain/player-poll.ts'
import type { LoadedList } from '../../src/domain/lists.ts'
import type { Mark } from '../../src/domain/marks.ts'
import type { Db } from './db.ts'

export type Game = {
  bggId: number
  name: string
  year: number | null
  thumbnailUrl: string | null
  description: string | null
  kind: 'boardgame' | 'expansion'
} & GameDetails

/** F008: the person's BGG username (null = none). */
export type UserSetting = { bggUsername: string | null; updatedAt: string }
/** F008: a friend's BGG user, lower-cased; `deleted` is the tombstone. */
export type FollowedBggUser = { bggUser: string; updatedAt: string; deleted: boolean }

export type Changes = {
  collections: Collection[]
  entries: Entry[]
  lists?: LoadedList[]
  settings?: UserSetting[]
  follows?: FollowedBggUser[]
}

/** An entry points at a collection that does not exist for this user. */
export class ForeignCollectionError extends Error {}

type CollectionRow = { id: string; name: string; updated_at: Date | string; deleted: boolean }
type EntryRow = {
  collection_id: string
  bgg_id: number
  mark: Mark
  bought: boolean
  paid_cents: number | null
  paid_currency: string | null
  booth: string | null
  price_cents: number | null
  currency: string | null
  publisher: string | null
  edition: string | null
  facts_source: 'preview' | 'manual' | null
  details_pending: boolean
  updated_at: Date | string
  deleted: boolean
}

const iso = (value: Date | string) => new Date(value).toISOString()

/** A PostgreSQL array literal; both the postgres driver and PGlite accept it for `$n::type[]`. */
const pgArray = (values: (string | number)[]) => `{${values.map(v => String(v).replace(/[^\w-]/g, '')).join(',')}}`

const toCollection = (r: CollectionRow): Collection => ({
  id: r.id,
  name: r.name,
  updatedAt: iso(r.updated_at),
  deleted: r.deleted,
})

function toEntry(r: EntryRow): Entry {
  const hasFacts = [r.booth, r.price_cents, r.currency, r.publisher, r.edition].some(v => v !== null) || r.facts_source !== null
  return {
    collectionId: r.collection_id,
    bggId: r.bgg_id,
    mark: r.mark,
    bought: r.bought,
    paidCents: r.paid_cents,
    paidCurrency: r.paid_currency,
    facts: hasFacts ? { booth: r.booth, priceCents: r.price_cents, currency: r.currency, publisher: r.publisher, edition: r.edition } : null,
    factsSource: r.facts_source,
    detailsPending: r.details_pending,
    updatedAt: iso(r.updated_at),
    deleted: r.deleted,
  }
}

/**
 * A cursor for the next pull: the database's clock a few seconds back, so writes that were still
 * on their way when this pull ran are fetched again next time (merging twice is harmless).
 */
export async function syncCursor(db: Db, marginSeconds = 5): Promise<string> {
  const [row] = await db.query<{ t: Date | string }>(`SELECT now() - make_interval(secs => $1) AS t`, [marginSeconds])
  return iso(row!.t)
}

/** Everything of one user, or only what the server received after `since` (tombstones included). */
export async function listChanges(db: Db, email: string, since?: string): Promise<Changes> {
  const after = since ?? '1970-01-01T00:00:00.000Z'
  const collections = await db.query<CollectionRow>(
    `SELECT id, name, updated_at, deleted FROM collection
     WHERE user_email = $1 AND synced_at > $2 ORDER BY updated_at`,
    [email, after],
  )
  const entries = await db.query<EntryRow>(
    `SELECT collection_id, bgg_id, mark, bought, paid_cents, paid_currency, booth, price_cents, currency,
            publisher, edition, facts_source, details_pending, updated_at, deleted
     FROM collection_entry WHERE user_email = $1 AND synced_at > $2 ORDER BY updated_at`,
    [email, after],
  )
  const lists = await db.query<ListRow>(
    `SELECT kind, list_id, title, updated_at, deleted FROM loaded_list
     WHERE user_email = $1 AND synced_at > $2 ORDER BY updated_at`,
    [email, after],
  )
  const settings = await db.query<{ bgg_username: string | null; updated_at: Date | string }>(
    `SELECT bgg_username, updated_at FROM user_setting WHERE user_email = $1 AND synced_at > $2`,
    [email, after],
  )
  const follows = await db.query<{ bgg_user: string; updated_at: Date | string; deleted: boolean }>(
    `SELECT bgg_user, updated_at, deleted FROM followed_bgg_user
     WHERE user_email = $1 AND synced_at > $2 ORDER BY updated_at, bgg_user`,
    [email, after],
  )
  return {
    collections: collections.map(toCollection),
    entries: entries.map(toEntry),
    lists: lists.map(r => ({ kind: r.kind, id: r.list_id, title: r.title, updatedAt: iso(r.updated_at), deleted: r.deleted })),
    settings: settings.map(r => ({ bggUsername: r.bgg_username, updatedAt: iso(r.updated_at) })),
    follows: follows.map(r => ({ bggUser: r.bgg_user, updatedAt: iso(r.updated_at), deleted: r.deleted })),
  }
}

/**
 * Upserts with last write wins in SQL: a row changes only when the incoming updatedAt is later.
 * Collections of other users are never touched; entries must belong to the caller's collections.
 */
export async function applyChanges(db: Db, email: string, changes: Changes) {
  let applied = 0
  for (const c of changes.collections) {
    const rows = await db.query(
      `INSERT INTO collection AS t (id, user_email, name, updated_at, deleted)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name,
         updated_at = excluded.updated_at, deleted = excluded.deleted, synced_at = now()
       WHERE t.user_email = excluded.user_email AND excluded.updated_at > t.updated_at
       RETURNING id`,
      [c.id, email, c.name, c.updatedAt, c.deleted],
    )
    applied += rows.length
  }

  const collectionIds = [...new Set(changes.entries.map(e => e.collectionId))]
  if (collectionIds.length > 0) {
    const owned = await db.query<{ id: string }>(
      `SELECT id FROM collection WHERE user_email = $1 AND id = ANY($2::uuid[])`,
      [email, pgArray(collectionIds)],
    )
    const ownedIds = new Set(owned.map(r => r.id))
    const foreign = collectionIds.find(id => !ownedIds.has(id))
    if (foreign) throw new ForeignCollectionError(`Collection ${foreign} does not exist.`)
  }

  for (const e of changes.entries) {
    const rows = await db.query(
      `INSERT INTO collection_entry AS t (collection_id, bgg_id, user_email, mark, bought, paid_cents, paid_currency,
         booth, price_cents, currency, publisher, edition, facts_source, details_pending, updated_at, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (collection_id, bgg_id) DO UPDATE SET mark = excluded.mark, bought = excluded.bought,
         paid_cents = excluded.paid_cents, paid_currency = excluded.paid_currency, booth = excluded.booth,
         price_cents = excluded.price_cents, currency = excluded.currency, publisher = excluded.publisher, edition = excluded.edition,
         facts_source = excluded.facts_source, details_pending = excluded.details_pending,
         updated_at = excluded.updated_at, deleted = excluded.deleted, synced_at = now()
       WHERE t.user_email = excluded.user_email AND excluded.updated_at > t.updated_at
       RETURNING bgg_id`,
      [
        e.collectionId,
        e.bggId,
        email,
        e.mark,
        e.bought,
        e.paidCents,
        e.paidCurrency,
        e.facts?.booth ?? null,
        e.facts?.priceCents ?? null,
        e.facts?.currency ?? null,
        e.facts?.publisher ?? null,
        e.facts?.edition ?? null,
        e.factsSource,
        e.detailsPending,
        e.updatedAt,
        e.deleted,
      ],
    )
    applied += rows.length
  }
  for (const l of changes.lists ?? []) {
    const rows = await db.query(
      `INSERT INTO loaded_list AS t (user_email, kind, list_id, title, updated_at, deleted)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_email, kind, list_id) DO UPDATE SET title = excluded.title,
         updated_at = excluded.updated_at, deleted = excluded.deleted, synced_at = now()
       WHERE excluded.updated_at > t.updated_at
       RETURNING list_id`,
      [email, l.kind, l.id, l.title, l.updatedAt, l.deleted],
    )
    applied += rows.length
  }
  for (const setting of changes.settings ?? []) {
    const rows = await db.query(
      `INSERT INTO user_setting AS t (user_email, bgg_username, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (user_email) DO UPDATE SET bgg_username = excluded.bgg_username,
         updated_at = excluded.updated_at, synced_at = now()
       WHERE excluded.updated_at > t.updated_at
       RETURNING user_email`,
      [email, setting.bggUsername, setting.updatedAt],
    )
    applied += rows.length
  }
  for (const f of changes.follows ?? []) {
    const rows = await db.query(
      `INSERT INTO followed_bgg_user AS t (user_email, bgg_user, updated_at, deleted) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_email, bgg_user) DO UPDATE SET updated_at = excluded.updated_at,
         deleted = excluded.deleted, synced_at = now()
       WHERE excluded.updated_at > t.updated_at
       RETURNING bgg_user`,
      [email, f.bggUser.toLowerCase(), f.updatedAt, f.deleted],
    )
    applied += rows.length
  }
  const total =
    changes.collections.length +
    changes.entries.length +
    (changes.lists?.length ?? 0) +
    (changes.settings?.length ?? 0) +
    (changes.follows?.length ?? 0)
  return { applied, ignored: total - applied }
}

type ListRow = { kind: 'preview' | 'geeklist'; list_id: number; title: string; updated_at: Date | string; deleted: boolean }

type GameRow = {
  bgg_id: number
  name: string
  year: number | null
  thumbnail_url: string | null
  description: string | null
  kind: 'boardgame' | 'expansion'
  min_players: number | null
  max_players: number | null
  designers: string[] | string | null
  mechanisms: string[] | string | null
  publisher: string | null
  rating: string | number | null
  geek_rating: string | number | null
  best_with: string | null
  recommended_with: string | null
  player_poll: PlayerVotes[] | string | null
  player_poll_voters: number | null
}

/** A numeric column: the production driver hands it over as text, PGlite as a number. */
const number = (value: string | number | null) => (value === null ? null : Number(value))

/** A jsonb list of names; the production driver hands jsonb over as text, PGlite as parsed JSON. */
function names(value: string[] | string | null): string[] {
  const list: unknown = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : []
}

/**
 * F005: the two rating columns of migration 0005, added by the Worker itself (idempotent, once per
 * isolate) so a deploy works before `npm run db:migrate:neon` has run; the migration also marks old
 * games stale so they get their ratings.
 */
// a flag, not a shared promise: a cancelled Worker request leaves its promises unsettled forever, and
// later requests awaiting it would hang; running the idempotent ALTERs twice is harmless
let gameColumnsReady = false
async function ensureRatingColumns(db: Db): Promise<void> {
  if (gameColumnsReady) return
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS rating numeric(4,2)')
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS geek_rating numeric(4,2)')
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS best_with text')
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS recommended_with text')
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS player_poll jsonb')
  await db.query('ALTER TABLE game ADD COLUMN IF NOT EXISTS player_poll_voters integer')
  gameColumnsReady = true
}

/** Cached games fetched after `freshAfter` (older ones are refreshed from BGG). */
export async function getCachedGames(db: Db, ids: number[], freshAfter: string): Promise<Game[]> {
  if (ids.length === 0) return []
  await ensureRatingColumns(db)
  const rows = await db.query<GameRow>(
    `SELECT bgg_id, name, year, thumbnail_url, description, kind, min_players, max_players, designers, mechanisms, publisher, rating, geek_rating, best_with, recommended_with, player_poll, player_poll_voters FROM game
     WHERE bgg_id = ANY($1::int[]) AND fetched_at > $2`,
    [pgArray(ids), freshAfter],
  )
  return rows.map(r => ({
    bggId: r.bgg_id,
    name: r.name,
    year: r.year,
    thumbnailUrl: r.thumbnail_url,
    description: r.description,
    kind: r.kind,
    minPlayers: r.min_players,
    maxPlayers: r.max_players,
    designers: names(r.designers),
    mechanisms: names(r.mechanisms),
    publisher: r.publisher,
    rating: number(r.rating),
    geekRating: number(r.geek_rating),
    bestWith: r.best_with,
    recommendedWith: r.recommended_with,
    // jsonb: text from the production driver, parsed by PGlite
    playerPoll: typeof r.player_poll === 'string' ? (JSON.parse(r.player_poll) as PlayerVotes[]) : r.player_poll,
    playerPollVoters: r.player_poll_voters,
  }))
}

export async function upsertGames(db: Db, games: Game[], fetchedAt: string) {
  await ensureRatingColumns(db)
  for (const g of games) {
    await db.query(
      `INSERT INTO game (bgg_id, name, year, thumbnail_url, description, kind, min_players, max_players, designers,
         mechanisms, publisher, rating, geek_rating, best_with, recommended_with, player_poll, player_poll_voters, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16::jsonb, $17, $18)
       ON CONFLICT (bgg_id) DO UPDATE SET name = excluded.name, year = excluded.year,
         thumbnail_url = excluded.thumbnail_url, description = excluded.description, kind = excluded.kind,
         min_players = excluded.min_players, max_players = excluded.max_players, designers = excluded.designers,
         mechanisms = excluded.mechanisms, publisher = excluded.publisher, rating = excluded.rating,
         geek_rating = excluded.geek_rating, best_with = excluded.best_with, recommended_with = excluded.recommended_with, player_poll = excluded.player_poll, player_poll_voters = excluded.player_poll_voters,
         fetched_at = excluded.fetched_at`,
      [
        g.bggId,
        g.name,
        g.year,
        g.thumbnailUrl,
        g.description,
        g.kind,
        g.minPlayers,
        g.maxPlayers,
        JSON.stringify(g.designers),
        JSON.stringify(g.mechanisms),
        g.publisher,
        g.rating ?? null,
        g.geekRating ?? null,
        g.bestWith ?? null,
        g.recommendedWith ?? null,
        g.playerPoll == null ? null : JSON.stringify(g.playerPoll),
        g.playerPollVoters ?? null,
        fetchedAt,
      ],
    )
  }
}
