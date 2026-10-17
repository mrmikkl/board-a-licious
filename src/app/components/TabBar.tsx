import { type Route, href } from '../router.ts'
import { IconCollections, IconLists, IconPlus, IconSearch, IconShare } from './icons.tsx'

const section = (route: Route) =>
  route.name === 'collection' || route.name === 'swipe' || route.name === 'add-link' ? 'collections' : route.name === 'list' ? 'lists' : route.name

/** Tabs: Collections, Lists, + (hexagon), Search (soon), Share (design.md "Navigation"). */
export function TabBar({ route, searchSoon }: { route: Route; searchSoon: boolean }) {
  const current = section(route)
  const tab = (name: string, label: string, icon: React.ReactNode, extra?: React.ReactNode) => (
    <a className="tab" href={href({ name } as Route)} aria-current={current === name ? 'page' : undefined}>
      {icon}
      <span>{label}</span>
      {extra}
    </a>
  )
  return (
    <nav className="tabbar" aria-label="Main">
      {tab('collections', 'Collections', <IconCollections />)}
      {tab('lists', 'Lists', <IconLists />)}
      <a className="tab-add hex hex-btn" href={href({ name: 'add' })} aria-label="Add a collection, BGG list or game" aria-current={current === 'add' ? 'page' : undefined}>
        <IconPlus />
      </a>
      {tab('search', 'Search', <IconSearch />, searchSoon ? <span className="soon">soon</span> : null)}
      {tab('share', 'Share', <IconShare />)}
    </nav>
  )
}
