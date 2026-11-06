import { useId, useState } from 'react'

import { usePriceLanguage, usePrices } from '../hooks/usePrices.ts'
import { OffersBlock } from './OffersBlock.tsx'

/**
 * F007 US2 (docs/design.md "Prices section"): a folded block in a game's details; nothing is loaded
 * until it is opened, then the offers block with the fair price on top.
 */
export function PricesSection({ bggId, name, fairPrice }: { bggId: number; name: string; fairPrice?: string | null }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const { state, retry } = usePrices(bggId, name, open)
  const [language, setLanguage] = usePriceLanguage()
  return (
    <section className="prices-sec">
      <button type="button" className="prices-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">💶</span>
        Prices
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="prices-body" id={bodyId} hidden={!open}>
        {open && <OffersBlock state={state} language={language} onLanguage={setLanguage} fairPrice={fairPrice} compact onRetry={retry} />}
      </div>
    </section>
  )
}
