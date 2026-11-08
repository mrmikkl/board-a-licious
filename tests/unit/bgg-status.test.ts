import { describe, expect, it } from 'vitest'

import {
  NO_STATUS, PRIORITY_NAMES, STATUS_KEYS, STATUS_NAMES, badges, counts, diff, fromBggFlags, hasAny, isSet, label, mergeCopies, statusList,
} from '../../src/domain/bgg-status.ts'
import type { BggCollectionItem, Status } from '../../src/domain/bgg-status.ts'

const status = (over: Partial<Status> = {}): Status => ({ ...NO_STATUS, ...over })
const item = (bggId: number, name: string, over: Partial<Status> = {}): BggCollectionItem => ({
  bggId, name, year: null, thumbnailUrl: null, kind: 'boardgame', status: status(over),
})
const ALL_ON: Status = { own: true, prevOwned: true, forTrade: true, wantInTrade: true, wantToBuy: true, wantToPlay: true, preordered: true, wishlist: 2 }
const BGG_OFF = { own: '0', prevowned: '0', fortrade: '0', want: '0', wanttoplay: '0', wanttobuy: '0', wishlist: '0', wishlistpriority: '3', preordered: '0' }

describe('bgg-status', () => {
  it('keeps the badge order', () => {
    expect(STATUS_KEYS).toEqual(['own', 'preordered', 'wishlist', 'wantToPlay', 'forTrade', 'wantInTrade', 'wantToBuy', 'prevOwned'])
  })

  it('labels each status, the wishlist with its priority', () => {
    expect(STATUS_KEYS.map(k => label(k, ALL_ON))).toEqual([
      'Owned', 'Preordered', 'Wishlist 2', 'Want to play', 'For trade', 'Want in trade', 'Want to buy', 'Previously owned',
    ])
    expect(label('wishlist', NO_STATUS)).toBe('Wishlist')
  })

  it('names the lists and the wishlist priorities', () => {
    expect(STATUS_KEYS.map(k => STATUS_NAMES[k])).toEqual([
      'Owned', 'Preordered', 'Wishlist', 'Want to play', 'For trade', 'Want in trade', 'Want to buy', 'Previously owned',
    ])
    expect(PRIORITY_NAMES).toEqual({ 1: 'Must have', 2: 'Love to have', 3: 'Like to have', 4: 'Thinking about it', 5: "Don't buy this" })
  })

  it('tells whether a status is set', () => {
    expect(isSet(status({ own: true }), 'own')).toBe(true)
    expect(isSet(status({ own: true }), 'forTrade')).toBe(false)
    expect(isSet(status({ wishlist: 5 }), 'wishlist')).toBe(true)
    expect(isSet(NO_STATUS, 'wishlist')).toBe(false)
  })

  it('has NO_STATUS with everything off and hasAny', () => {
    expect(NO_STATUS).toEqual({ own: false, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null })
    expect(hasAny(NO_STATUS)).toBe(false)
    expect(hasAny(status({ prevOwned: true }))).toBe(true)
    expect(hasAny(status({ wishlist: 1 }))).toBe(true)
  })

  describe('badges', () => {
    it('shows the set keys in badge order', () => {
      expect(badges(status({ prevOwned: true, wishlist: 1, own: true }))).toEqual({ shown: ['own', 'wishlist', 'prevOwned'], rest: 0 })
      expect(badges(NO_STATUS)).toEqual({ shown: [], rest: 0 })
    })

    it('shows at most max and counts the rest', () => {
      expect(badges(ALL_ON, 3)).toEqual({ shown: ['own', 'preordered', 'wishlist'], rest: 5 })
      expect(badges(status({ own: true }), 3)).toEqual({ shown: ['own'], rest: 0 })
    })
  })

  describe('statusList', () => {
    const items = [
      item(1, 'zoo', { own: true, wishlist: 3 }),
      item(2, 'Ägypten', { own: true, wishlist: 1 }),
      item(3, 'Azul', { wishlist: 3 }),
      item(4, 'brass', { own: true }),
      item(5, 'Carcassonne', { forTrade: true }),
    ]

    it('lists the items with the key by name, ignoring case and accents', () => {
      expect(statusList(items, 'own').map(i => i.bggId)).toEqual([2, 4, 1])
      expect(statusList(items, 'forTrade').map(i => i.bggId)).toEqual([5])
      expect(statusList(items, 'prevOwned')).toEqual([])
    })

    it('sorts the wishlist by priority, then name', () => {
      expect(statusList(items, 'wishlist').map(i => i.bggId)).toEqual([2, 3, 1])
    })

    it('leaves the input alone', () => {
      statusList(items, 'own')
      expect(items.map(i => i.bggId)).toEqual([1, 2, 3, 4, 5])
    })
  })

  it('counts the items per status', () => {
    expect(counts([item(1, 'a', { own: true, wishlist: 2 }), item(2, 'b', { own: true }), item(3, 'c')])).toEqual({
      own: 2, preordered: 0, wishlist: 1, wantToPlay: 0, forTrade: 0, wantInTrade: 0, wantToBuy: 0, prevOwned: 0,
    })
  })

  describe('diff', () => {
    it('is empty when nothing changed', () => {
      expect(diff(ALL_ON, { ...ALL_ON })).toEqual({})
    })

    it('holds only the changed keys', () => {
      expect(diff(NO_STATUS, status({ own: true, wishlist: 3 }))).toEqual({ own: true, wishlist: 3 })
      expect(diff(status({ wishlist: 3, forTrade: true }), status({ wishlist: 1, forTrade: true }))).toEqual({ wishlist: 1 })
      expect(diff(status({ wishlist: 3 }), NO_STATUS)).toEqual({ wishlist: null })
    })
  })

  describe('mergeCopies', () => {
    it('keeps one item per game, a flag set when any copy has it', () => {
      const merged = mergeCopies([
        item(1, 'Azul', { own: true }),
        item(2, 'Brass', { forTrade: true }),
        item(1, 'Azul', { prevOwned: true }),
      ])
      expect(merged.map(i => i.bggId)).toEqual([1, 2])
      expect(merged[0].status).toEqual(status({ own: true, prevOwned: true }))
      expect(merged[1].status).toEqual(status({ forTrade: true }))
    })

    it('takes the most wanted wishlist priority', () => {
      expect(mergeCopies([item(1, 'A', { wishlist: 4 }), item(1, 'A'), item(1, 'A', { wishlist: 2 })])[0].status.wishlist).toBe(2)
      expect(mergeCopies([item(1, 'A'), item(1, 'A')])[0].status.wishlist).toBeNull()
    })

    it('does not change the input items', () => {
      const first = item(1, 'A', { own: true })
      mergeCopies([first, item(1, 'A', { forTrade: true })])
      expect(first.status).toEqual(status({ own: true }))
    })
  })

  describe('fromBggFlags', () => {
    it('reads all off', () => {
      expect(fromBggFlags(BGG_OFF)).toEqual(NO_STATUS)
    })

    it('maps each BGG flag, want meaning Want in trade', () => {
      expect(fromBggFlags({ ...BGG_OFF, own: '1' })).toEqual(status({ own: true }))
      expect(fromBggFlags({ ...BGG_OFF, prevowned: '1' })).toEqual(status({ prevOwned: true }))
      expect(fromBggFlags({ ...BGG_OFF, fortrade: '1' })).toEqual(status({ forTrade: true }))
      expect(fromBggFlags({ ...BGG_OFF, want: '1' })).toEqual(status({ wantInTrade: true }))
      expect(fromBggFlags({ ...BGG_OFF, wanttoplay: '1' })).toEqual(status({ wantToPlay: true }))
      expect(fromBggFlags({ ...BGG_OFF, wanttobuy: '1' })).toEqual(status({ wantToBuy: true }))
      expect(fromBggFlags({ ...BGG_OFF, preordered: '1' })).toEqual(status({ preordered: true }))
    })

    it('reads the wishlist with its priority, 3 when it is missing or invalid', () => {
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: '1' }).wishlist).toBe(1)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: '5' }).wishlist).toBe(5)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: '0' }).wishlist).toBe(3)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: '7' }).wishlist).toBe(3)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: 'x' }).wishlist).toBe(3)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '1', wishlistpriority: undefined }).wishlist).toBe(3)
      expect(fromBggFlags({ ...BGG_OFF, wishlist: '0', wishlistpriority: '1' }).wishlist).toBeNull()
    })
  })
})
