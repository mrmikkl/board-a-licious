import { describe, expect, it } from 'vitest'

import { type Route, href, parseRoute } from '../../src/app/router.ts'

describe('routes that open sheets (contracts/navigation.md)', () => {
  it.each<[string, Route]>([
    ['#/collections?new', { name: 'collections', create: true }],
    ['#/lists?load', { name: 'lists', load: true }],
    ['#/collections/c1?add=game', { name: 'collection', id: 'c1', open: 'game' }],
    ['#/collections/c1?add=list', { name: 'collection', id: 'c1', open: 'list' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
    expect(href(route)).toBe(hash)
  })

  it('leaves the flags out when they are not set', () => {
    expect(parseRoute('#/collections')).toEqual({ name: 'collections' })
    expect(parseRoute('#/lists')).toEqual({ name: 'lists' })
    expect(parseRoute('#/collections/c1')).toEqual({ name: 'collection', id: 'c1' })
    expect(parseRoute('#/collections/c1?add=other')).toEqual({ name: 'collection', id: 'c1' })
    expect(href({ name: 'collections' })).toBe('#/collections')
    expect(href({ name: 'collection', id: 'c1' })).toBe('#/collections/c1')
  })
})

describe('Show-off routes (F004 research R7)', () => {
  it.each<[string, Route]>([
    ['#/collections/c1?show-off', { name: 'collection', id: 'c1', open: 'showoff' }],
    ['#/collections/c1/show-off/must_have,interested', { name: 'showoff', id: 'c1', groups: ['must_have', 'interested'] }],
    ['#/collections/c1/show-off/new', { name: 'showoff', id: 'c1', groups: ['new'] }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
    expect(href(route)).toBe(hash)
  })

  it('drops unknown marks and goes back to the collection without a valid one', () => {
    expect(parseRoute('#/collections/c1/show-off/must_have,bogus')).toEqual({ name: 'showoff', id: 'c1', groups: ['must_have'] })
    expect(parseRoute('#/collections/c1/show-off/bogus')).toEqual({ name: 'collection', id: 'c1' })
    expect(parseRoute('#/collections/c1/show-off/')).toEqual({ name: 'collection', id: 'c1' })
    expect(parseRoute('#/collections/c1/show-off')).toEqual({ name: 'collection', id: 'c1' })
  })
})

describe('old addresses of the add screen', () => {
  it.each<[string, Route]>([
    ['#/add', { name: 'collections' }],
    ['#/add/collection', { name: 'collections', create: true }],
    ['#/add/list', { name: 'lists', load: true }],
    ['#/add/game', { name: 'collections' }],
  ])('%s', (hash, route) => expect(parseRoute(hash)).toEqual(route))
})

describe('unchanged routes', () => {
  it.each<[string, Route]>([
    ['#/collections/c1/swipe/preview/93', { name: 'swipe', id: 'c1', list: { kind: 'preview', id: 93 } }],
    ['#/collections/c1/swipe', { name: 'swipe', id: 'c1' }],
    ['#/lists/geeklist/12', { name: 'list', kind: 'geeklist', listId: 12 }],
    ['#/search', { name: 'search' }],
    ['#/config', { name: 'config' }],
    ['#/config/share', { name: 'share' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
    expect(href(route)).toBe(hash)
  })

  it('keeps the shared route with its query', () => {
    const route = parseRoute('#/shared?title=Cascadia&url=https%3A%2F%2Fboardgamegeek.com%2Fboardgame%2F295947')
    expect(route).toEqual({ name: 'shared', title: 'Cascadia', text: undefined, url: 'https://boardgamegeek.com/boardgame/295947' })
  })
})
