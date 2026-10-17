import { useId } from 'react'

import { type GameLink, parseGameLink } from '../../domain/bgg-link.ts'

export type LinkState = { text: string; name: string; parsed: GameLink | null }

export const emptyLink: LinkState = { text: '', name: '', parsed: null }

/** The next state after the link was edited: a newly recognised game brings its suggested name. */
export function editLink(state: LinkState, text: string): LinkState {
  const parsed = text.trim() ? parseGameLink(text) : null
  const sameGame = parsed?.ok && state.parsed?.ok && parsed.bggId === state.parsed.bggId
  return { text, parsed, name: parsed?.ok && !sameGame ? parsed.suggestedName : state.name }
}

/** Link field, hint, and the recognised game with its editable name (FR-016). */
export function GameLinkFields({ state, onChange, note }: { state: LinkState; onChange: (state: LinkState) => void; note?: string }) {
  const linkId = useId()
  const nameId = useId()
  const hintId = useId()
  const { parsed } = state
  return (
    <>
      <div>
        <label className="label" htmlFor={linkId}>
          BoardGameGeek link
        </label>
        <div className="field">
          <input
            id={linkId}
            inputMode="url"
            autoComplete="off"
            placeholder="boardgamegeek.com/boardgame/…"
            value={state.text}
            aria-describedby={parsed && !parsed.ok ? hintId : undefined}
            aria-invalid={parsed ? !parsed.ok : undefined}
            onChange={e => onChange(editLink(state, e.target.value))}
          />
        </div>
        {parsed && !parsed.ok && (
          <p className="hint error" id={hintId}>
            {parsed.message}
          </p>
        )}
      </div>
      {parsed?.ok && (
        <div>
          <h2 className="section-title">
            Found game <small>ID {parsed.bggId}</small>
          </h2>
          <label className="label" htmlFor={nameId}>
            Name
          </label>
          <div className="field">
            <input id={nameId} value={state.name} autoComplete="off" onChange={e => onChange({ ...state, name: e.target.value })} />
          </div>
          <p className="hint">{note ?? 'Name, year and cover are filled in from BoardGameGeek.'}</p>
        </div>
      )}
    </>
  )
}
