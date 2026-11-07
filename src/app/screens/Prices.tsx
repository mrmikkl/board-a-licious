import { useEffect, useState } from 'react'

import type { Game } from '../../client/types.ts'
import { Header } from '../components/Header.tsx'
import { HexCover } from '../components/HexCover.tsx'
import { OffersBlock } from '../components/OffersBlock.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { usePriceLanguage, usePrices } from '../hooks/usePrices.ts'
import { href } from '../router.ts'

/** F007 (docs/design.md "Price screen"): a game's offers, from the Buy search. */
export function Prices({ bggId }: { bggId: number }) {
  const { api } = useServices()
  const stored = useStoreData(store => store.game(bggId), [bggId])
  const [fetched, setFetched] = useState<Game>()
  useEffect(() => {
    if (stored !== undefined && stored !== null) return
    let active = true
    api.games([bggId]).then(([game]) => active && game && setFetched(game), () => {})
    return () => {
      active = false
    }
  }, [api, bggId, stored])
  const game = stored ?? fetched
  const { state, retry } = usePrices(bggId, game?.name)
  const [language, setLanguage] = usePriceLanguage()
  return (
    <>
      <Header title="Prices" back={href({ name: 'buy' })} />
      <main className="screen">
        <div className="game-head">
          <HexCover game={game} name={game?.name ?? '…'} size={64} />
          <span className="row-meta">
            <span className="row-name">{game?.name ?? 'Loading…'}</span>
            <span className="row-sub">{[game?.year, game?.publisher].filter(Boolean).join(' · ')}</span>
          </span>
        </div>
        <hr className="separator" />
        <OffersBlock state={state} language={language} onLanguage={setLanguage} onRetry={retry} />
      </main>
    </>
  )
}
