import { useEffect, useState } from 'react'

/** Hash routes, so deep links work offline from the precached app shell. */
export type Route =
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'swipe'; id: string }
  | { name: 'add-link'; id: string }
  | { name: 'lists' }
  | { name: 'list'; kind: 'preview' | 'geeklist'; listId: number }
  | { name: 'add'; what?: 'collection' | 'list' | 'game' }
  | { name: 'search' }
  | { name: 'config' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [first, second, third] = parts
  switch (first) {
    case 'collections':
      if (second && third === 'swipe') return { name: 'swipe', id: second }
      if (second && third === 'add-link') return { name: 'add-link', id: second }
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
    case 'share': // old links
      return { name: 'config' }
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
      return `#/collections/${encodeURIComponent(route.id)}/swipe`
    case 'add-link':
      return `#/collections/${encodeURIComponent(route.id)}/add-link`
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
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route)
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
