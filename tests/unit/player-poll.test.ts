import { describe, expect, it } from 'vitest'

import { type PlayerVotes, pollKind, pollTable } from '../../src/domain/player-poll.ts'

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

describe('pollKind: best or recommended with n (F009 research R3)', () => {
  it('is best when best votes are the largest, recommended when best + recommended beat not recommended', () => {
    expect([1, 2, 3, 4].map(n => pollKind(cascadia, n))).toEqual(['rec', 'best', 'best', 'rec'])
  })

  it('is null when not recommended wins, and when nobody voted for n', () => {
    expect(pollKind(cascadia, 5)).toBeNull()
    expect(pollKind([{ players: '2', best: 0, recommended: 0, notRecommended: 0 }], 2)).toBeNull()
    expect(pollKind([{ players: '2', best: 5, recommended: 1, notRecommended: 0 }], 3)).toBeNull()
    expect(pollKind([], 2)).toBeNull()
    expect(pollKind(null, 2)).toBeNull()
    expect(pollKind(undefined, 2)).toBeNull()
  })

  it("uses the poll's largest row (4+) for any larger n", () => {
    const poll: PlayerVotes[] = [
      { players: '3', best: 1, recommended: 5, notRecommended: 0 },
      { players: '4', best: 2, recommended: 3, notRecommended: 1 },
      { players: '4+', best: 1, recommended: 6, notRecommended: 2 },
    ]
    expect(pollKind(poll, 4)).toBe('rec')
    expect(pollKind(poll, 5)).toBe('rec')
    expect(pollKind(poll, 12)).toBe('rec')
    expect(pollKind(poll, 2)).toBeNull()
  })
})
