import { useId, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import { NO_STATUS, STATUS_NAMES, type StatusChange, type StatusKey, isSet } from '../../domain/bgg-status.ts'
import { useServices } from '../context.tsx'
import { saveOnBgg, useBggAccount, useOnline } from '../hooks/useBggAccount.ts'
import { useBggSearch } from '../hooks/useBggSearch.ts'
import { useBgg } from './BggBadges.tsx'
import { IconSearch } from './icons.tsx'
import { SearchResultRow } from './SearchResultRow.tsx'
import { Sheet } from './Sheet.tsx'
import { SignInSheet } from './SignInSheet.tsx'
import { useToast } from './Toast.tsx'

/** A new wishlist game gets BGG's middle priority, "Like to have" (as the BGG status section). */
const WISHLIST_PRIORITY = 3

/**
 * F008 feedback: the main action of one of the person's own status lists. Find a game on BGG by name;
 * a tap sets this status on BoardGameGeek and keeps its other statuses (the server merges, research R3).
 * Needs the BGG sign-in; one tap is one save.
 */
export function AddToStatusSheet({ status, onClose }: { status: StatusKey; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const bgg = useBgg()
  const online = useOnline()
  const { signedInAs } = useBggAccount()
  const search = useBggSearch(20)
  const fieldId = useId()
  const [picked, setPicked] = useState<SearchResult>()
  const [step, setStep] = useState<'search' | 'saving' | 'signin'>('search')
  const [problem, setProblem] = useState<string>()
  const statusName = STATUS_NAMES[status]
  const title = `Add a game to ${statusName}`

  const save = async (result: SearchResult, signedIn = Boolean(signedInAs)) => {
    const game = search.games.get(result.bggId)
    const name = game?.name || result.name
    if (isSet(bgg.statuses.get(result.bggId) ?? NO_STATUS, status)) return setProblem(`${name} is already on ${statusName}.`)
    setPicked(result)
    if (!signedIn) return setStep('signin')
    setStep('saving')
    setProblem(undefined)
    const change: StatusChange = status === 'wishlist' ? { wishlist: WISHLIST_PRIORITY } : { [status]: true }
    try {
      if (game) await services.store.putGames([game])
      const item = { bggId: result.bggId, name, year: result.year ?? null, kind: result.kind, thumbnailUrl: game?.thumbnailUrl ?? null }
      await saveOnBgg(services, bgg.username, item, { status: change })
      onClose()
      toast(`Saved on BoardGameGeek: ${name} → ${statusName}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'bgg_signed_out') return setStep('signin')
      setProblem(
        error instanceof ApiError && error.code === 'offline'
          ? 'No connection. Nothing was changed on BoardGameGeek.'
          : 'BoardGameGeek did not take the change. Nothing was changed there.',
      )
      setStep('search')
    }
  }

  if (step === 'signin') return <SignInSheet onSignedIn={() => picked && void save(picked, true)} onCancel={() => setStep('search')} />

  const s = search.state
  return (
    <Sheet open title={title} onClose={onClose}>
      {step === 'saving' ? (
        <p className="result-status" role="status">
          <span className="spin-hex" aria-hidden="true" />
          Saving on BoardGameGeek…
        </p>
      ) : (
        <>
          <p className="lead">Find the game on BoardGameGeek. A tap puts it on {statusName} there; its other statuses stay.</p>
          <label className="label" htmlFor={fieldId}>
            Game name
          </label>
          <div className={services.bggSearch && online ? 'field search' : 'field search is-disabled'}>
            <IconSearch />
            <input
              id={fieldId}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Game name, e.g. Cascadia"
              maxLength={100}
              disabled={!services.bggSearch || !online}
              value={s.text}
              onChange={e => search.change(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  search.searchNow()
                }
              }}
            />
          </div>
          {!online && <p className="hint">Changing statuses needs a connection.</p>}
          {problem && (
            <p className="hint error" role="alert">
              {problem}
            </p>
          )}
          <p className="hint" role="status">
            {s.status === 'loading'
              ? 'Searching BoardGameGeek…'
              : s.status === 'short'
                ? 'Type at least 2 letters.'
                : s.status === 'done' && s.results.length === 0
                  ? `No game called “${s.text.trim()}” on BoardGameGeek.`
                  : s.status === 'offline' || s.status === 'unavailable'
                    ? 'BoardGameGeek is not reachable. Try again in a moment.'
                    : ''}
          </p>
          {s.status === 'done' && s.results.length > 0 && (
            <ul className="matches" aria-label="Matching games">
              {s.results.map(result => (
                <li key={result.bggId}>
                  <SearchResultRow result={result} game={search.games.get(result.bggId)} onOpen={() => void save(result)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
