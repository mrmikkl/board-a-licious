import { BggSearchPanel } from '../components/BggSearchPanel.tsx'
import { Header } from '../components/Header.tsx'
import type { Route } from '../router.ts'

const route = (game?: number): Route => (game ? { name: 'search', game } : { name: 'search' })

/**
 * The Search place (menu): find any game on BoardGameGeek and look at it. A result opens the game sheet
 * (`browse`): Add to shopping lists, Players, BGG status, prices. Buy › Search is the same search for prices.
 */
export function Search({ game }: { game?: number }) {
  return (
    <>
      <Header title="Search" />
      <BggSearchPanel game={game} route={route} sheet="browse" />
    </>
  )
}
