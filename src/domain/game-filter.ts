import type { GameDetails } from './game-info.ts'
import { type PollKind, pollKind, pollRow } from './player-poll.ts'

/** F009 (data-model "GameFilter"): the four named ranges of game length. */
export type LengthRange = 'short' | 'middle' | 'long' | 'veryLong'
/** F009 (data-model "LengthLimits"): where Short, Middle and Long end, in minutes. */
export type LengthLimits = [number, number, number]

/** Filter by what BGG says about a game; sections combine with AND, the defaults filter nothing. */
export type GameFilter = {
  /** Any ticked range (OR); empty = any length. */
  length: LengthRange[]
  /** Best or recommended (per `kinds`, never empty) with n players; null = any. */
  players: { n: number; kinds: PollKind[] } | null
  /** BGG's average rating from–to, inclusive; [0, 10] = any. */
  rating: [number, number]
  geekRating: [number, number]
  /** Every ticked value (AND). */
  mechanisms: string[]
  designers: string[]
}

/** The filter as kept in device meta: only the sections that are set. */
export type StoredGameFilter = Partial<GameFilter>

/** A game's BGG details as the filter reads them; undefined = not on the device yet. */
export type FilterDetails = (Partial<GameDetails> & { playingTime?: number | null }) | null | undefined

export const LENGTH_RANGES: LengthRange[] = ['short', 'middle', 'long', 'veryLong']
export const DEFAULT_LENGTH_LIMITS: LengthLimits = [30, 60, 120]
export const PLAYER_KINDS: PollKind[] = ['best', 'rec']
const FULL: [number, number] = [0, 10]

export const DEFAULT_GAME_FILTER: GameFilter = Object.freeze({
  length: [],
  players: null,
  rating: FULL,
  geekRating: FULL,
  mechanisms: [],
  designers: [],
}) as GameFilter

const NAMES: Record<LengthRange, string> = { short: 'Short', middle: 'Middle', long: 'Long', veryLong: 'Very long' }

/** Three whole numbers of 1–600, strictly increasing. */
export function validLengthLimits(value: unknown): value is LengthLimits {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(v => Number.isInteger(v) && v >= 1 && v <= 600) &&
    value[0] < value[1] &&
    value[1] < value[2]
  )
}

/** The four ranges with their names and minute texts ("0–30 min" … "121+ min"). */
export function lengthRanges(limits: LengthLimits): { range: LengthRange; name: string; text: string }[] {
  const [a, b, c] = limits
  const texts = [`0–${a} min`, `${a + 1}–${b} min`, `${b + 1}–${c} min`, `${c + 1}+ min`]
  return LENGTH_RANGES.map((range, i) => ({ range, name: NAMES[range], text: texts[i]! }))
}

/** The range a playing time falls into; null without one (BGG's 0 means unknown). */
export function lengthOf(minutes: number | null | undefined, limits: LengthLimits): LengthRange | null {
  if (typeof minutes !== 'number' || !(minutes > 0)) return null
  const index = limits.findIndex(end => minutes <= end)
  return LENGTH_RANGES[index === -1 ? 3 : index]!
}

const isFull = (range: [number, number]) => range[0] <= 0 && range[1] >= 10
const known = (value: number | null | undefined): value is number => typeof value === 'number' && value > 0
// ratings are stored with two decimals and the slider steps by 0.1: compare with a little slack
const inRange = (value: number, [from, to]: [number, number]) => value >= from - 1e-9 && value <= to + 1e-9

/**
 * FR-003/FR-006: whether a game passes the filter. A game without the value a set section needs does
 * not match that section; a game without details matches only the default filter.
 */
export function matchesGame(details: FilterDetails, filter: GameFilter, limits: LengthLimits): boolean {
  if (filter.length.length > 0) {
    const range = lengthOf(details?.playingTime, limits)
    if (!range || !filter.length.includes(range)) return false
  }
  if (filter.players) {
    const kind = pollKind(details?.playerPoll, filter.players.n)
    if (!kind || !filter.players.kinds.includes(kind)) return false
  }
  for (const key of ['rating', 'geekRating'] as const) {
    if (isFull(filter[key])) continue
    const value = details?.[key]
    if (!known(value) || !inRange(value, filter[key])) return false
  }
  for (const key of ['mechanisms', 'designers'] as const) {
    if (filter[key].length === 0) continue
    const values = details?.[key] ?? []
    if (!filter[key].every(v => values.includes(v))) return false
  }
  return true
}

/** How many games carry each mechanism or designer, most common first, then by name. */
export function valueCounts(games: FilterDetails[], key: 'mechanisms' | 'designers'): { value: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const game of games) for (const value of new Set(game?.[key] ?? [])) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/**
 * FR-006: per section, how many games lack the value it needs: no playing time, no rating, and for
 * players nobody voted for the chosen n (without n: nobody voted at all).
 */
export function missingCounts(games: FilterDetails[], filter: GameFilter) {
  const count = (missing: (d: FilterDetails) => boolean) => games.filter(missing).length
  return {
    length: count(d => !known(d?.playingTime)),
    players: count(d => (filter.players ? !pollRow(d?.playerPoll, filter.players.n) : !(d?.playerPoll ?? []).some(v => v.best + v.recommended + v.notRecommended > 0))),
    rating: count(d => !known(d?.rating)),
    geekRating: count(d => !known(d?.geekRating)),
  }
}

export function isDefaultGameFilter(filter: GameFilter): boolean {
  return (
    filter.length.length === 0 &&
    filter.players === null &&
    isFull(filter.rating) &&
    isFull(filter.geekRating) &&
    filter.mechanisms.length === 0 &&
    filter.designers.length === 0
  )
}

/** Only the sections that are set, as plain JSON. */
export function toStoredGameFilter(filter: GameFilter): StoredGameFilter {
  const stored: StoredGameFilter = {}
  if (filter.length.length > 0) stored.length = [...filter.length]
  if (filter.players) stored.players = { n: filter.players.n, kinds: [...filter.players.kinds] }
  if (!isFull(filter.rating)) stored.rating = [...filter.rating]
  if (!isFull(filter.geekRating)) stored.geekRating = [...filter.geekRating]
  if (filter.mechanisms.length > 0) stored.mechanisms = [...filter.mechanisms]
  if (filter.designers.length > 0) stored.designers = [...filter.designers]
  return stored
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
function range(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return FULL
  const [from, to] = value as unknown[]
  return typeof from === 'number' && typeof to === 'number' && from >= 0 && to <= 10 && from <= to ? [from, to] : FULL
}
function players(value: unknown): GameFilter['players'] {
  const p = value as { n?: unknown; kinds?: unknown } | null
  if (typeof p !== 'object' || p === null || !Number.isInteger(p.n) || (p.n as number) < 1 || (p.n as number) > 99) return null
  const kinds = PLAYER_KINDS.filter(k => strings(p.kinds).includes(k))
  return { n: p.n as number, kinds: kinds.length > 0 ? kinds : [...PLAYER_KINDS] }
}

/** The filter from device meta; anything missing or broken reads as its default. */
export function fromStoredGameFilter(value: unknown): GameFilter {
  const s = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    length: LENGTH_RANGES.filter(r => strings(s.length).includes(r)),
    players: players(s.players),
    rating: range(s.rating),
    geekRating: range(s.geekRating),
    mechanisms: strings(s.mechanisms),
    designers: strings(s.designers),
  }
}
