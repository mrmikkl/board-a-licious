import { type Route, href } from '../router.ts'
import { IconCollections, IconConfig, IconLists, IconPlus, IconSearch } from './icons.tsx'

const section = (route: Route) =>
  route.name === 'collection' || route.name === 'swipe' || route.name === 'add-link' ? 'collections' : route.name === 'list' ? 'lists' : route.name

/** Tabs: Collections, Lists, + (hexagon), Search, Config (docs/design.md v1.1.0 "Navigation"). */
export function TabBar({ route }: { route: Route }) {
  const current = section(route)
  const tab = (name: string, label: string, icon: React.ReactNode) => (
    <a className="tab" href={href({ name } as Route)} aria-current={current === name ? 'page' : undefined}>
      {icon}
      <span>{label}</span>
    </a>
  )
  return (
    <nav className="tabbar" aria-label="Main">
      {tab('collections', 'Collections', <IconCollections />)}
      {tab('lists', 'Lists', <IconLists />)}
      <a className="tab-add hex hex-btn" href={href({ name: 'add' })} aria-label="Add a collection, BGG list or game" aria-current={current === 'add' ? 'page' : undefined}>
        <IconPlus />
      </a>
      {tab('search', 'Search', <IconSearch />)}
      {tab('config', 'Config', <IconConfig />)}
    </nav>
  )
}
