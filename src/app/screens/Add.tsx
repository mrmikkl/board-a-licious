import { type FormEvent, useId, useState } from 'react'

import { parseListLink } from '../../domain/lists.ts'
import { type LinkState, GameLinkFields, emptyLink } from '../components/GameLinkFields.tsx'
import { Header } from '../components/Header.tsx'
import { HexPicker } from '../components/HexPicker.tsx'
import { IconCollections, IconLists } from '../components/icons.tsx'
import { NewCollectionForm } from '../components/NewCollectionForm.tsx'
import { useToast } from '../components/Toast.tsx'
import { addGameByLink } from '../actions.ts'
import { useServices, useStoreData } from '../context.tsx'
import { navigate } from '../router.ts'

type What = 'collection' | 'list' | 'game'

const IconGame = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" strokeLinecap="round" strokeWidth="3" />
  </svg>
)

const KINDS = [
  { key: 'collection' as const, label: 'Collection', icon: <IconCollections /> },
  { key: 'list' as const, label: 'BGG list', icon: <IconLists /> },
  { key: 'game' as const, label: 'Game', icon: <IconGame /> },
]

/** The + button: add a collection, a BGG list or a single game. */
export function Add({ what }: { what?: What }) {
  return (
    <>
      <Header title="Add" />
      <main className="screen">
        <p className="lead">What do you want to add?</p>
        <HexPicker label="What to add" options={KINDS} value={what} onPick={key => navigate({ name: 'add', what: key })} />
        {what === 'collection' && <CollectionForm />}
        {what === 'list' && <ListForm />}
        {what === 'game' && <GameForm />}
      </main>
    </>
  )
}

function CollectionForm() {
  return (
    <section aria-labelledby="add-collection">
      <h2 className="section-title" id="add-collection">
        New collection
      </h2>
      <NewCollectionForm onCreated={c => navigate({ name: 'collection', id: c.id })} />
    </section>
  )
}

/** Load a BGG list by its link (FR-012): previews are Essen lists, geeklists have no facts. */
function ListForm() {
  const linkId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const list = parseListLink(text)
  const hint = !text.trim()
    ? null
    : !list
      ? 'Paste a link to a BoardGameGeek preview or geeklist, like boardgamegeek.com/geekpreview/93.'
      : list.kind === 'preview'
        ? 'Preview: an Essen list with booth, price and publisher.'
        : 'Geeklist: games without booth and price.'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (list) navigate({ name: 'list', kind: list.kind, listId: list.id })
  }

  return (
    <section aria-labelledby="add-list">
      <h2 className="section-title" id="add-list">
        Load a BGG list
      </h2>
      <form className="form" onSubmit={submit}>
        <p className="lead">Paste the link of a BoardGameGeek preview (like SPIEL Essen 2026, with booth, price and publisher) or a geeklist.</p>
        <div>
          <label className="label" htmlFor={linkId}>
            BGG list link
          </label>
          <div className="field">
            <input
              id={linkId}
              inputMode="url"
              autoComplete="off"
              placeholder="boardgamegeek.com/geekpreview/…"
              value={text}
              aria-describedby={hint ? hintId : undefined}
              aria-invalid={hint ? !list : undefined}
              onChange={e => setText(e.target.value)}
            />
          </div>
          {hint && (
            <p className={`hint${list ? '' : ' error'}`} id={hintId}>
              {hint}
            </p>
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={!list}>
          Load list
        </button>
      </form>
    </section>
  )
}

/** Add a single game by link with a collection dropdown; with no collection yet, create one first (FR-016). */
function GameForm() {
  const services = useServices()
  const toast = useToast()
  const selectId = useId()
  const [link, setLink] = useState<LinkState>(emptyLink)
  const [chosen, setChosen] = useState<string>()
  const [busy, setBusy] = useState(false)
  const data = useStoreData(async store => {
    const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
    const entries = (await store.allEntries()).filter(e => !e.deleted)
    return { collections, entries }
  })
  if (!data) return null

  const parsed = link.parsed?.ok ? link.parsed : null
  const inside = (collectionId: string) => Boolean(parsed && data.entries.some(e => e.collectionId === collectionId && e.bggId === parsed.bggId))
  const collection = data.collections.find(c => c.id === chosen) ?? data.collections.find(c => !inside(c.id)) ?? data.collections[0]
  const already = collection ? inside(collection.id) : false
  const ready = Boolean(parsed && link.name.trim() && collection && !already && !busy)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !parsed || !collection) return
    setBusy(true)
    try {
      await addGameByLink(services, collection.id, parsed.bggId, link.name)
      toast(`Added ${link.name.trim()} to ${collection.name}`)
      navigate({ name: 'collection', id: collection.id })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="add-game">
      <h2 className="section-title" id="add-game">
        Add a single game
      </h2>
      {data.collections.length === 0 ? (
        <>
          <p className="lead">A game goes into a collection, and you have none yet. Create one first, then add the game.</p>
          <NewCollectionForm initialName="SPIEL 2026" nameLabel="Collection name" onCreated={c => setChosen(c.id)} />
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="lead">For games on none of your lists: copy the game's link on boardgamegeek.com and paste it here.</p>
          <GameLinkFields state={link} onChange={setLink} />
          <div>
            <label className="label" htmlFor={selectId}>
              Collection
            </label>
            <div className="field select">
              <select id={selectId} value={collection?.id} onChange={e => setChosen(e.target.value)}>
                {data.collections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {inside(c.id) ? ' (already in it)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {already && collection && <p className="hint error">This game is already in {collection.name}. Pick another collection.</p>}
            {!already && collection?.type === 'essen' && parsed && (
              <p className="hint">Added by link, the game has no booth, price and publisher; you can type them in later.</p>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={!ready}>
            Add game
          </button>
        </form>
      )}
    </section>
  )
}
