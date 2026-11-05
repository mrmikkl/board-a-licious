import { describe, expect, it } from 'vitest'

import { type PlayerVotes, pollTable } from '../../src/domain/player-poll.ts'

/** Cascadia's poll from tests/fixtures/bgg-xml/thing-295947-385318.xml */
const cascadia: PlayerVotes[] = [
  { players: '1', best: 133, recommended: 439, notRecommended: 145 },
  { players: '2', best: 587, recommended: 334, notRecommended: 17 },
  { players: '3', best: 551, recommended: 324, notRecommended: 17 },
  { players: '4', best: 188, recommended: 552, notRecommended: 82 },
  { players: '4+', best: 2, recommended: 37, notRecommended: 455 },
]

describe('player poll table (F006 FR-006b)', () => {
  it('gives each player count its share of votes in percent, rounded', () => {
    const table = pollTable(cascadia)!
    expect(table.rows.map(r => [r.players, r.best.percent, r.recommended.percent, r.notRecommended.percent])).toEqual([
      ['1', 19, 61, 20],
      ['2', 63, 36, 2],
      ['3', 62, 36, 2],
      ['4', 23, 67, 10],
      ['4+', 0, 7, 92],
    ])
  })

  it('marks the highest percentage of each column', () => {
    const table = pollTable(cascadia)!
    expect(table.rows.filter(r => r.best.highest).map(r => r.players)).toEqual(['2'])
    expect(table.rows.filter(r => r.recommended.highest).map(r => r.players)).toEqual(['4'])
    expect(table.rows.filter(r => r.notRecommended.highest).map(r => r.players)).toEqual(['4+'])
  })

  it('marks every row that shares the highest value', () => {
    const table = pollTable([
      { players: '1', best: 1, recommended: 1, notRecommended: 0 },
      { players: '2', best: 1, recommended: 1, notRecommended: 0 },
    ])!
    expect(table.rows.map(r => r.best.highest)).toEqual([true, true])
    expect(table.rows.map(r => r.notRecommended.highest)).toEqual([false, false])
  })

  it('leaves out player counts without votes, and has no table when nobody voted', () => {
    expect(pollTable([{ players: '4+', best: 0, recommended: 0, notRecommended: 0 }])).toBeNull()
    expect(pollTable(null)).toBeNull()
    expect(pollTable(undefined)).toBeNull()
    expect(pollTable([...cascadia, { players: '5', best: 0, recommended: 0, notRecommended: 0 }])?.rows).toHaveLength(5)
  })
})
