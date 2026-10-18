import { useEffect, useState } from 'react'

/** Hash routes, so deep links work offline from the precached app shell. */
export type Route =
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'swipe'; id: string; list?: { kind: 'preview' | 'geeklist'; id: number } }
  | { name: 'lists' }
  | { name: 'list'; kind: 'preview' | 'geeklist'; listId: number }
  | { name: 'add'; what?: 'collection' | 'list' | 'game' }
  | { name: 'search' }
  | { name: 'config' }
  | { name: 'share' }
  /** F002: something shared to the app (contracts/share-target.md) */
  | { name: 'shared'; title?: string; text?: string; url?: string }

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const [first, second, third] = parts
  switch (first) {
    case 'collections':
      if (second && third === 'swipe') {
        const [, , , kind, listId] = parts
        return (kind === 'preview' || kind === 'geeklist') && Number(listId) > 0
          ? { name: 'swipe', id: second, list: { kind, id: Number(listId) } }
          : { name: 'swipe', id: second }
      }
      return second ? { name: 'collection', id: second } : { name: 'collections' }
    case 'lists':
      if ((second === 'preview' || second === 'geeklist') && Number(third) > 0)
        return { name: 'list', kind: second, listId: Number(third) }
      return { name: 'lists' }
    case 'add':
      return second === 'collection' || second === 'list' || second === 'game' ? { name: 'add', what: second } : { name: 'add' }
    case 'search':
      return { name: 'search' }
    case 'config':
      return second === 'share' ? { name: 'share' } : { name: 'config' }
    case 'share': // old links
      return { name: 'share' }
    case 'shared': {
      const params = new URLSearchParams(query)
      const value = (key: string) => params.get(key) ?? undefined
      return { name: 'shared', title: value('title'), text: value('text'), url: value('url') }
    }
    default:
      return { name: 'collections' }
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'collections':
      return '#/collections'
    case 'collection':
      return `#/collections/${encodeURIComponent(route.id)}`
    case 'swipe':
      return `#/collections/${encodeURIComponent(route.id)}/swipe${route.list ? `/${route.list.kind}/${route.list.id}` : ''}`
    case 'lists':
      return '#/lists'
    case 'list':
      return `#/lists/${route.kind}/${route.listId}`
    case 'add':
      return route.what ? `#/add/${route.what}` : '#/add'
    case 'search':
      return '#/search'
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
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
