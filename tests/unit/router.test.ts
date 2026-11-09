import { describe, expect, it } from 'vitest'

import { type Route, href, isOldAddress, parseRoute } from '../../src/app/router.ts'

/** Every address of contracts/ui.md "Routes" reads as its route and is written back the same way. */
const both = (hash: string, route: Route) => {
  expect(parseRoute(hash)).toEqual(route)
  expect(href(route)).toBe(hash)
}

describe('Buy (F008 contracts/ui.md "Routes")', () => {
  it.each<[string, Route]>([
    ['#/buy', { name: 'buy' }],
    ['#/buy?game=295947', { name: 'buy', game: 295947 }],
    ['#/buy/lists', { name: 'collections' }],
    ['#/buy/lists?new', { name: 'collections', create: true }],
    ['#/buy/lists/c1', { name: 'collection', id: 'c1' }],
    ['#/buy/lists/c1?add=game', { name: 'collection', id: 'c1', open: 'game' }],
    ['#/buy/lists/c1?add=list', { name: 'collection', id: 'c1', open: 'list' }],
    ['#/buy/lists/c1?show-off', { name: 'collection', id: 'c1', open: 'showoff' }],
    ['#/buy/lists/c1/show-off/must_have,interested', { name: 'showoff', id: 'c1', groups: ['must_have', 'interested'] }],
    ['#/buy/lists/c1/show-off/new', { name: 'showoff', id: 'c1', groups: ['new'] }],
    ['#/buy/lists/c1/swipe', { name: 'swipe', id: 'c1' }],
    ['#/buy/lists/c1/swipe/preview/93', { name: 'swipe', id: 'c1', list: { kind: 'preview', id: 93 } }],
    ['#/buy/lists/c1/swipe/geeklist/12', { name: 'swipe', id: 'c1', list: { kind: 'geeklist', id: 12 } }],
    // F008: swiping a status list
    ['#/buy/lists/c1/swipe/status/mrmikkl/wishlist', { name: 'swipe', id: 'c1', list: { kind: 'status', bggUser: 'mrmikkl', status: 'wishlist' } }],
    ['#/buy/lists/c1/swipe/status/anna_meeple/wanttoplay', { name: 'swipe', id: 'c1', list: { kind: 'status', bggUser: 'anna_meeple', status: 'wantToPlay' } }],
  ])('%s', both)

  it('a status swipe without a known status is the swipe without a list', () => {
    expect(parseRoute('#/buy/lists/c1/swipe/status/mrmikkl/bogus')).toEqual({ name: 'swipe', id: 'c1' })
    expect(parseRoute('#/buy/lists/c1/swipe/status')).toEqual({ name: 'swipe', id: 'c1' })
  })

  it('leaves out flags that are not set, and an invalid game', () => {
    expect(parseRoute('#/buy/lists/c1?add=other')).toEqual({ name: 'collection', id: 'c1' })
    expect(parseRoute('#/buy?game=abc')).toEqual({ name: 'buy' })
    expect(parseRoute('#/buy?game=0')).toEqual({ name: 'buy' })
  })

  it('drops unknown categories of Show-off, and without a valid one it is the shopping list', () => {
    expect(parseRoute('#/buy/lists/c1/show-off/must_have,bogus')).toEqual({ name: 'showoff', id: 'c1', groups: ['must_have'] })
    expect(parseRoute('#/buy/lists/c1/show-off/bogus')).toEqual({ name: 'collection', id: 'c1' })
    expect(parseRoute('#/buy/lists/c1/show-off')).toEqual({ name: 'collection', id: 'c1' })
  })
})

describe('Lists (F008 contracts/ui.md "Routes")', () => {
  it.each<[string, Route]>([
    ['#/lists', { name: 'lists' }],
    ['#/lists?load', { name: 'lists', load: true }],
    ['#/lists/status', { name: 'lists', tab: 'status' }],
    ['#/lists/previews', { name: 'lists', tab: 'previews' }],
    ['#/lists/geeklists', { name: 'lists', tab: 'geeklists' }],
    ['#/lists/geeklists?load', { name: 'lists', tab: 'geeklists', load: true }],
    ['#/lists/search', { name: 'lists', tab: 'search' }],
    ['#/lists/search?game=13', { name: 'lists', tab: 'search', game: 13 }],
    ['#/lists/preview/93', { name: 'list', kind: 'preview', listId: 93 }],
    ['#/lists/geeklist/12', { name: 'list', kind: 'geeklist', listId: 12 }],
    ['#/lists/status/anna_meeple/own', { name: 'status-list', bggUser: 'anna_meeple', status: 'own' }],
    ['#/lists/status/anna_meeple/preordered', { name: 'status-list', bggUser: 'anna_meeple', status: 'preordered' }],
    ['#/lists/status/anna_meeple/wishlist', { name: 'status-list', bggUser: 'anna_meeple', status: 'wishlist' }],
    ['#/lists/status/anna_meeple/wanttoplay', { name: 'status-list', bggUser: 'anna_meeple', status: 'wantToPlay' }],
    ['#/lists/status/anna_meeple/fortrade', { name: 'status-list', bggUser: 'anna_meeple', status: 'forTrade' }],
    ['#/lists/status/anna_meeple/want', { name: 'status-list', bggUser: 'anna_meeple', status: 'wantInTrade' }],
    ['#/lists/status/anna_meeple/wanttobuy', { name: 'status-list', bggUser: 'anna_meeple', status: 'wantToBuy' }],
    ['#/lists/status/anna_meeple/prevowned', { name: 'status-list', bggUser: 'anna_meeple', status: 'prevOwned' }],
    ['#/lists/status/Jo%20Smith/own', { name: 'status-list', bggUser: 'Jo Smith', status: 'own' }],
  ])('%s', both)

  it('an unknown status or tab is the Lists place', () => {
    expect(parseRoute('#/lists/status/anna_meeple/bogus')).toEqual({ name: 'lists', tab: 'status' })
    expect(parseRoute('#/lists/bogus')).toEqual({ name: 'lists' })
    expect(parseRoute('#/lists/preview/abc')).toEqual({ name: 'lists' })
  })
})

describe('Config and shared', () => {
  it.each<[string, Route]>([
    ['#/config', { name: 'config' }],
    ['#/config/share', { name: 'share' }],
  ])('%s', both)

  it('keeps the shared route with its query', () => {
    const route = parseRoute('#/shared?title=Cascadia&url=https%3A%2F%2Fboardgamegeek.com%2Fboardgame%2F295947')
    expect(route).toEqual({ name: 'shared', title: 'Cascadia', text: undefined, url: 'https://boardgamegeek.com/boardgame/295947' })
  })

  it('an unknown address opens the shopping lists', () => {
    expect(parseRoute('')).toEqual({ name: 'collections' })
    expect(parseRoute('#/nowhere')).toEqual({ name: 'collections' })
  })
})

describe('old addresses map to the new places (FR: US0 scenario 7)', () => {
  it.each<[string, string]>([
    ['#/collections', '#/buy/lists'],
    ['#/collections?new', '#/buy/lists?new'],
    ['#/collections/c1', '#/buy/lists/c1'],
    ['#/collections/c1?add=game', '#/buy/lists/c1?add=game'],
    ['#/collections/c1?show-off', '#/buy/lists/c1?show-off'],
    ['#/collections/c1/show-off/must_have', '#/buy/lists/c1/show-off/must_have'],
    ['#/collections/c1/swipe', '#/buy/lists/c1/swipe'],
    ['#/collections/c1/swipe/preview/1', '#/buy/lists/c1/swipe/preview/1'],
    ['#/buy/295947', '#/buy?game=295947'],
    ['#/buy/abc', '#/buy'],
    ['#/search', '#/buy'],
    ['#/add', '#/buy/lists'],
    ['#/add/collection', '#/buy/lists?new'],
    ['#/add/list', '#/lists?load'],
    ['#/add/game', '#/buy/lists'],
    ['#/share', '#/config/share'],
  ])('%s → %s', (old, now) => {
    expect(href(parseRoute(old))).toBe(now)
    expect(isOldAddress(old)).toBe(true)
  })

  it('new addresses are not old', () => {
    for (const hash of ['#/buy', '#/buy?game=1', '#/buy/lists', '#/buy/lists/c1/swipe', '#/lists', '#/lists/status', '#/config', '#/shared?title=x', ''])
      expect(isOldAddress(hash)).toBe(false)
  })
})
