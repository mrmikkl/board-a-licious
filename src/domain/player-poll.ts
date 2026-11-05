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
