import { useEffect, useState } from 'react'

import type { StatusKey } from '../domain/bgg-status.ts'
import { type Mark, isMark } from '../domain/marks.ts'

/** F008: the tabs of the Lists place (contracts/ui.md "Routes"). */
export type ListsTab = 'status' | 'previews' | 'geeklists'
const LISTS_TABS: ListsTab[] = ['status', 'previews', 'geeklists']

/** F008: a status in an address: BGG's own lower-case names (contracts/ui.md "Routes"). */
const STATUS_SLUGS: Record<StatusKey, string> = {
  own: 'own',
  preordered: 'preordered',
  wishlist: 'wishlist',
  wantToPlay: 'wanttoplay',
  forTrade: 'fortrade',
  wantInTrade: 'want',
  wantToBuy: 'wanttobuy',
  prevOwned: 'prevowned',
}
const statusOf = (slug: string | undefined) => (Object.keys(STATUS_SLUGS) as StatusKey[]).find(k => STATUS_SLUGS[k] === slug)

/** F008: what BG-Tinder swipes: a loaded BGG list, or a status list of a BGG user. */
export type SwipeSource = { kind: 'preview' | 'geeklist'; id: number } | { kind: 'status'; bggUser: string; status: StatusKey }

/** Hash routes, so deep links work offline from the precached app shell. */
export type Route =
  /** Buy › Shopping lists (code still says collections); `create` opens the New shopping list sheet (`#/buy/lists?new`) */
  | { name: 'collections'; create?: true }
  /** F003: `open` opens Add game or BG-Tinder (`?add=game|list`); F004: the Show-off sheet (`?show-off`) */
  | { name: 'collection'; id: string; open?: 'game' | 'list' | 'showoff' }
  /** F004: the Show-off screen of a collection for the chosen groups (research R7) */
  | { name: 'showoff'; id: string; groups: Mark[] }
  | { name: 'swipe'; id: string; list?: SwipeSource }
  /** F008: Lists on a tab (none: the last used one); `load` opens the Load a BGG list sheet */
  | { name: 'lists'; tab?: ListsTab; load?: true }
  | { name: 'list'; kind: 'preview' | 'geeklist'; listId: number }
  /** F008: one status list of a BGG user */
  | { name: 'status-list'; bggUser: string; status: StatusKey }
  /** F008: Buy › Search, `game` with that game's sheet open */
  | { name: 'buy'; game?: number }
  | { name: 'config' }
  | { name: 'share' }
  /** F002: something shared to the app (contracts/share-target.md) */
  | { name: 'shared'; title?: string; text?: string; url?: string }

const positive = (value: string | null | undefined) => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined)

/** A shopping list and its sub-screens: `parts` after the list's id, as in `#/buy/lists/<id>/…`. */
function shoppingList(id: string, parts: string[], params: URLSearchParams): Route {
  const [sub, kind, listId] = parts
  if (sub === 'swipe') {
    const status = statusOf(parts[3])
    if (kind === 'status') return listId && status ? { name: 'swipe', id, list: { kind, bggUser: listId, status } } : { name: 'swipe', id }
    return (kind === 'preview' || kind === 'geeklist') && positive(listId) ? { name: 'swipe', id, list: { kind, id: Number(listId) } } : { name: 'swipe', id }
  }
  if (sub === 'show-off') {
    // unknown marks are dropped; without a valid one the address is the collection itself
    const groups = (kind ?? '').split(',').filter(isMark)
    return groups.length > 0 ? { name: 'showoff', id, groups } : { name: 'collection', id }
  }
  if (params.has('show-off')) return { name: 'collection', id, open: 'showoff' }
  const open = params.get('add')
  return open === 'game' || open === 'list' ? { name: 'collection', id, open } : { name: 'collection', id }
}

function shoppingLists(id: string | undefined, rest: string[], params: URLSearchParams): Route {
  if (id) return shoppingList(id, rest, params)
  return params.has('new') ? { name: 'collections', create: true } : { name: 'collections' }
}

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const [first, second, third] = parts
  const params = new URLSearchParams(query)
  switch (first) {
    case 'buy':
      if (second === 'lists') return shoppingLists(third, parts.slice(3), params)
      // old: `#/buy/<bggId>` was the price screen of feature 007
      {
        const game = positive(second) ?? positive(params.get('game'))
        return game ? { name: 'buy', game } : { name: 'buy' }
      }
    case 'collections': // old address of the shopping lists
      return shoppingLists(second, parts.slice(2), params)
    case 'lists': {
      if ((second === 'preview' || second === 'geeklist') && positive(third)) return { name: 'list', kind: second, listId: Number(third) }
      const status = statusOf(parts[3])
      if (second === 'status' && third && status) return { name: 'status-list', bggUser: third, status }
      const tab = LISTS_TABS.find(t => t === second)
      const load = params.has('load') ? { load: true as const } : {}
      return tab && (!third || second === 'status') ? { name: 'lists', tab, ...load } : { name: 'lists', ...load }
    }
    case 'add': // the add screen of 001/002 is gone; its old addresses open the matching sheet
      return second === 'collection' ? { name: 'collections', create: true } : second === 'list' ? { name: 'lists', load: true } : { name: 'collections' }
    case 'search': // the Search place of feature 006 is Buy › Search now
      return { name: 'buy' }
    case 'config':
      return second === 'share' ? { name: 'share' } : { name: 'config' }
    case 'share': // old links
      return { name: 'share' }
    case 'shared': {
      const value = (key: string) => params.get(key) ?? undefined
      return { name: 'shared', title: value('title'), text: value('text'), url: value('url') }
    }
    default:
      return { name: 'collections' }
  }
}

/** Addresses from before F008 (and older), which the app rewrites to their new form. */
export function isOldAddress(hash: string): boolean {
  return /^#\/(collections|search|add|share)(?=[/?]|$)|^#\/buy\/(?!lists(?=[/?]|$))/.test(hash)
}

export function href(route: Route): string {
  const list = (id: string) => `#/buy/lists/${encodeURIComponent(id)}`
  switch (route.name) {
    case 'collections':
      return route.create ? '#/buy/lists?new' : '#/buy/lists'
    case 'collection':
      return `${list(route.id)}${route.open === 'showoff' ? '?show-off' : route.open ? `?add=${route.open}` : ''}`
    case 'showoff':
      return `${list(route.id)}/show-off/${route.groups.join(',')}`
    case 'swipe':
      return `${list(route.id)}/swipe${!route.list ? '' : route.list.kind === 'status' ? `/status/${encodeURIComponent(route.list.bggUser)}/${STATUS_SLUGS[route.list.status]}` : `/${route.list.kind}/${route.list.id}`}`
    case 'lists':
      return `#/lists${route.tab ? `/${route.tab}` : ''}${route.load ? '?load' : ''}`
    case 'list':
      return `#/lists/${route.kind}/${route.listId}`
    case 'status-list':
      return `#/lists/status/${encodeURIComponent(route.bggUser)}/${STATUS_SLUGS[route.status]}`
    case 'buy':
      return route.game ? `#/buy?game=${route.game}` : '#/buy'
    case 'config':
      return '#/config'
    case 'share':
      return '#/config/share'
    case 'shared': {
      const params = new URLSearchParams()
      for (const key of ['title', 'text', 'url'] as const) if (route[key]) params.set(key, route[key])
      return `#/shared?${params}`
    }
  }
}

/** Goes to a route; `replace` swaps the current history entry (e.g. leaving a share, so Back does not reopen it). */
export function navigate(route: Route, options: { replace?: boolean } = {}) {
  if (options.replace) window.location.replace(href(route))
  else window.location.hash = href(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    // F008: an old address (bookmark, link) shows its new form in the address bar
    const rewrite = () => {
      if (isOldAddress(window.location.hash)) window.history.replaceState(window.history.state, '', href(parseRoute(window.location.hash)))
    }
    rewrite()
    // a new screen starts at the top; a sheet opened by the query (`?game=`, `?add=`) keeps the scroll position
    let path = window.location.hash.split('?')[0]
    const onChange = () => {
      rewrite()
      setRoute(parseRoute(window.location.hash))
      const next = window.location.hash.split('?')[0]
      if (next !== path) window.scrollTo(0, 0)
      path = next
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
