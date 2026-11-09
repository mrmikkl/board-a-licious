/** F006: one player count of BGG's "suggested number of players" poll, as vote counts. */
export type PlayerVotes = { players: string; best: number; recommended: number; notRecommended: number }

export type PollCell = { percent: number; highest: boolean }
export type PollRow = { players: string; best: PollCell; recommended: PollCell; notRecommended: PollCell }

const COLUMNS = ['best', 'recommended', 'notRecommended'] as const

/**
 * FR-006b: the poll as a table: per player count its votes in percent of that count's votes (rounded),
 * and per column the highest percentage marked (all rows sharing it). Counts nobody voted on are left
 * out; no table when nobody voted at all.
 */
export function pollTable(poll: PlayerVotes[] | null | undefined): { rows: PollRow[] } | null {
  const voted = (poll ?? []).filter(v => v.best + v.recommended + v.notRecommended > 0)
  if (voted.length === 0) return null
  const percents = voted.map(v => {
    const total = v.best + v.recommended + v.notRecommended
    return { players: v.players, best: Math.round((v.best / total) * 100), recommended: Math.round((v.recommended / total) * 100), notRecommended: Math.round((v.notRecommended / total) * 100) }
  })
  const max = Object.fromEntries(COLUMNS.map(c => [c, Math.max(...percents.map(p => p[c]))])) as Record<(typeof COLUMNS)[number], number>
  return {
    rows: percents.map(p => ({
      players: p.players,
      best: { percent: p.best, highest: p.best > 0 && p.best === max.best },
      recommended: { percent: p.recommended, highest: p.recommended > 0 && p.recommended === max.recommended },
      notRecommended: { percent: p.notRecommended, highest: p.notRecommended > 0 && p.notRecommended === max.notRecommended },
    })),
  }
}

/** Whether a game is best (`best`) or recommended (`rec`) with a number of players. */
export type PollKind = 'best' | 'rec'

/**
 * F009 research R3: the poll's row for n players: the row named n, else for an n above the poll's
 * largest row ("4+") that row; undefined when there is none or nobody voted on it.
 */
export function pollRow(poll: PlayerVotes[] | null | undefined, n: number): PlayerVotes | undefined {
  const voted = (poll ?? []).filter(v => v.best + v.recommended + v.notRecommended > 0)
  const exact = voted.find(v => v.players.trim() === String(n))
  if (exact) return exact
  const plus = voted
    .map(v => ({ v, from: /^(\d+)\+$/.exec(v.players.trim())?.[1] }))
    .filter((p): p is { v: PlayerVotes; from: string } => p.from !== undefined && n > Number(p.from))
    .sort((a, b) => Number(b.from) - Number(a.from))
  return plus[0]?.v
}

/**
 * F009 research R3, as BGG sums it up: best with n when best votes are the largest of the three;
 * recommended when not best and best + recommended outweigh not recommended; else null (also when
 * nobody voted for n).
 */
export function pollKind(poll: PlayerVotes[] | null | undefined, n: number): PollKind | null {
  const row = pollRow(poll, n)
  if (!row) return null
  if (row.best > row.notRecommended && row.best >= row.recommended) return 'best'
  return row.best + row.recommended > row.notRecommended ? 'rec' : null
}
