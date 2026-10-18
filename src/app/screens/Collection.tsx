import { type FormEvent, useCallback, useId, useState } from 'react'

import { groupByHall } from '../../domain/booths.ts'
import { type Collection as CollectionRow, NAME_MAX, boughtLine, countMarks, groupByMark } from '../../domain/collection.ts'
import { type Filter, applyFilter, fromStored, groupCounts, presetOf } from '../../domain/filter.ts'
import { deleteCollection, renameCollection, saveFilter, saveGroupBy } from '../actions.ts'
import { Counter } from '../components/Counter.tsx'
import { EssenBadge } from '../components/EssenBadge.tsx'
import { FilterPanel } from '../components/FilterPanel.tsx'
import { GameRow } from '../components/GameRow.tsx'
import { GameSheet } from '../components/GameSheet.tsx'
import { GroupHeading } from '../components/GroupHeading.tsx'
import { Header } from '../components/Header.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { href, navigate } from '../router.ts'

/**
 * One collection: games grouped by mark, Not yet marked first, Not interested collapsed (FR-005);
 * filtered by groups and bought (FR-009), with the games bought and the money spent (FR-008).
 */
export function Collection({ id }: { id: string }) {
  const services = useServices()
  const [openGame, setOpenGame] = useState<number>()
  // the filter picked on this screen, shown at once while it is saved to the device
  const [chosen, setChosen] = useState<{ id: string; filter: Filter }>()
  const [showSkip, setShowSkip] = useState(false)
  const [menu, setMenu] = useState(false)
  const [groupChoice, setGroupChoice] = useState<{ id: string; groupBy: 'mark' | 'booth' }>()
  const closeGame = useCallback(() => setOpenGame(undefined), [])
  const closeMenu = useCallback(() => setMenu(false), [])
  const data = useStoreData(
    async store => {
      const collection = (await store.collections()).find(c => c.id === id && !c.deleted)
      const entries = (await store.entries(id)).filter(e => !e.deleted)
      const games = new Map((await store.games(entries.map(e => e.bggId))).map(g => [g.bggId, g]))
      const storedFilter = (await store.meta('activeFilter'))?.[id]
      const storedGroupBy = (await store.meta('groupBy'))?.[id]
      return { id, collection, entries, games, storedFilter, storedGroupBy }
    },
    [id],
  )
  const back = href({ name: 'collections' })
  if (!data || data.id !== id) return <Header title="" back={back} />
  const { collection, entries, games, storedFilter, storedGroupBy } = data
  if (!collection) {
    return (
      <>
        <Header title="Collection" back={back} />
        <main className="screen">
          <div className="empty">
            <div className="hex" />
            <h2>This collection does not exist anymore</h2>
            <p>It may have been deleted on another device.</p>
            <div className="actions">
              <a className="btn btn-primary" href={back}>
                Go to your collections
              </a>
            </div>
          </div>
        </main>
      </>
    )
  }

  const filter = chosen?.id === id ? chosen.filter : fromStored(storedFilter)
  const changeFilter = (next: Filter) => {
    setChosen({ id, filter: next })
    void saveFilter(services, id, next)
  }
  const shown = applyFilter(entries, filter)
  const nameOf = (e: { bggId: number }) => games.get(e.bggId)?.name ?? ''
  const groupBy = groupChoice?.id === id ? groupChoice.groupBy : (storedGroupBy ?? 'mark')
  const changeGroupBy = (next: 'mark' | 'booth') => {
    setGroupChoice({ id, groupBy: next })
    void saveGroupBy(services, id, next)
  }
  // by mark (FR-005) or by fair hall, taken from the booth (hall view)
  const groups =
    groupBy === 'booth'
      ? groupByHall(shown, nameOf).map(g => ({ id: `group-hall-${g.key}`, heading: { key: g.key === 'none' ? 'none' : 'hall', label: g.label }, folds: false, entries: g.entries }))
      : groupByMark(shown, nameOf).map(g => ({ id: `group-${g.mark.key}`, heading: g.mark, folds: g.mark.key === 'skip', entries: g.entries }))
  const bought = boughtLine(entries)
  const boughtCount = countMarks(entries).bought
  const current = entries.find(e => e.bggId === openGame)
  const actions = (
    <>
      <a className="btn btn-primary" href={href({ name: 'swipe', id })}>
        Add by list
      </a>
      <a className="btn" href={href({ name: 'add-link', id })}>
        Add by link
      </a>
    </>
  )

  return (
    <>
      <Header
        title={collection.name}
        back={back}
        badge={collection.type === 'essen' ? <EssenBadge /> : undefined}
        actions={
          <button type="button" className="icon-btn" aria-label="Collection options" aria-haspopup="dialog" onClick={() => setMenu(true)}>
            ⋯
          </button>
        }
      />
      <main className="screen">
        {entries.length === 0 ? (
          <div className="empty">
            <div className="hex" />
            <h2>No games in {collection.name} yet</h2>
            <p>Go through a BGG list and swipe the games you care about into it, or add a single game by its link.</p>
            <div className="actions">{actions}</div>
          </div>
        ) : (
          <>
            <div className="row-actions">{actions}</div>
            <hr className="separator" />
            <FilterPanel filter={filter} shown={shown.length} counts={groupCounts(entries, filter.bought, filter.price)} onChange={changeFilter} />
            <div className="group-by">
              <label className="label" htmlFor="group-by">
                Group by
              </label>
              <div className="field select">
                <select id="group-by" value={groupBy} onChange={e => changeGroupBy(e.target.value as 'mark' | 'booth')}>
                  <option value="mark">Marks</option>
                  <option value="booth">Booth (hall)</option>
                </select>
              </div>
            </div>
            {bought && (
              <p className="bought-line">
                ✅ <Counter value={boughtCount} />
                {bought.slice(`✅ ${boughtCount}`.length)}
              </p>
            )}
            <hr className="separator" />
            {shown.length === 0 && <FilterEmpty filter={filter} name={collection.name} hasMustHave={entries.some(e => e.mark === 'must_have')} />}
            {groups.map(group => {
              const headingId = group.id
              const folds = group.folds
              return (
                <section key={group.id} className="group" aria-labelledby={headingId}>
                  <GroupHeading
                    id={headingId}
                    mark={group.heading}
                    count={group.entries.length}
                    open={folds ? showSkip : undefined}
                    onToggle={folds ? () => setShowSkip(open => !open) : undefined}
                  />
                  <ul className="rows" hidden={folds && !showSkip}>
                    {group.entries.map(entry => (
                      <li key={entry.bggId}>
                        <GameRow entry={entry} game={games.get(entry.bggId)} onOpen={() => setOpenGame(entry.bggId)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </>
        )}
      </main>
      {current && <GameSheet entry={current} game={games.get(current.bggId)} collection={collection} onClose={closeGame} />}
      {menu && <CollectionMenu collection={collection} gameCount={entries.length} onClose={closeMenu} />}
    </>
  )
}

/** The filter shows nothing (spec Edge Cases); the hunt preset celebrates that nothing is left. */
function FilterEmpty({ filter, name, hasMustHave }: { filter: Filter; name: string; hasMustHave: boolean }) {
  const hunt = presetOf(filter) === 'hunt'
  return (
    <div className="empty">
      <div className="hex" />
      <h2>{hunt ? 'Nothing left to hunt 🎉' : 'No games match this filter'}</h2>
      <p>{hunt ? (hasMustHave ? `Every Must Have in ${name} is bought.` : `No game in ${name} is marked Must Have yet.`) : 'Open the filter to show more games.'}</p>
    </div>
  )
}

/** Rename (1–60 characters) or delete with confirmation; the type stays fixed (FR-001a). */
function CollectionMenu({ collection, gameCount, onClose }: { collection: CollectionRow; gameCount: number; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const nameId = useId()
  const [name, setName] = useState(collection.name)
  const [confirm, setConfirm] = useState(false)
  const trimmed = name.trim()
  const canRename = trimmed.length > 0 && trimmed.length <= NAME_MAX && trimmed !== collection.name

  const rename = async (event: FormEvent) => {
    event.preventDefault()
    if (!canRename) return
    await renameCollection(services, collection, name)
    onClose()
    toast(`Renamed to ${trimmed}`)
  }
  const remove = async () => {
    await deleteCollection(services, collection)
    toast(`Deleted ${collection.name}`)
    navigate({ name: 'collections' })
  }

  if (confirm) {
    return (
      <Sheet open title={`Delete ${collection.name} and its ${gameCount} ${gameCount === 1 ? 'game' : 'games'}?`} onClose={onClose}>
        <p className="lead">Marks, bought games and prices in it are deleted too, on all your devices.</p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-block btn-danger" onClick={() => void remove()}>
            Delete collection
          </button>
          <button type="button" className="btn btn-block" onClick={onClose}>
            Cancel
          </button>
        </div>
      </Sheet>
    )
  }
  return (
    <Sheet open title="Collection" onClose={onClose}>
      <form className="form" onSubmit={rename}>
        <div>
          <label className="label" htmlFor={nameId}>
            Name
          </label>
          <div className="field">
            <input id={nameId} value={name} maxLength={NAME_MAX} autoComplete="off" onChange={e => setName(e.target.value)} />
          </div>
          <p className="hint">{collection.type === 'essen' ? 'Essen collection' : 'Standard collection'}; the type cannot change.</p>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={!canRename}>
          Save name
        </button>
      </form>
      <div className="sheet-actions">
        <button type="button" className="btn btn-block btn-danger" onClick={() => setConfirm(true)}>
          Delete collection…
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
