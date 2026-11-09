import { BggSearchPanel } from '../components/BggSearchPanel.tsx'
import { Header } from '../components/Header.tsx'
import { PlaceTabs } from '../components/PlaceTabs.tsx'
import { Collections } from './Collections.tsx'

const buyRoute = (game?: number) => (game ? { name: 'buy' as const, game } : { name: 'buy' as const })

/**
 * F008 (docs/design.md "Buy"): the menu's first place with the tabs Search (find any game on
 * BoardGameGeek; a result opens that one game with its prices) and Shopping lists (the person's collections).
 */
export function Buy({ tab, game, create }: { tab: 'search' | 'shopping'; game?: number; create?: boolean }) {
  return (
    <>
      <Header title="Buy" />
      <PlaceTabs
        place="buy"
        label="Buy"
        current={tab}
        tabs={[
          { key: 'search', label: 'Search', route: { name: 'buy' } },
          { key: 'shopping', label: 'Shopping lists', route: { name: 'collections' } },
        ]}
      />
      {tab === 'search' ? <BggSearchPanel tab="buy" game={game} route={buyRoute} sheet="buy" /> : <Collections create={create} />}
    </>
  )
}

