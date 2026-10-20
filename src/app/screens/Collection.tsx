import { type FormEvent, Fragment, useCallback, useId, useState } from 'react'

import { groupByHall } from '../../domain/booths.ts'
import { type Collection as CollectionRow, NAME_MAX, boughtLine, countMarks, groupByMark } from '../../domain/collection.ts'
import { type Filter, applyFilter, filterLabel, fromStored, groupCounts, presetOf } from '../../domain/filter.ts'
import { deleteCollection, renameCollection, saveFilter, saveGroupBy } from '../actions.ts'
import { Action, ActionBar, MainButton } from '../components/ActionBar.tsx'
import { AddGameSheet } from '../components/AddGameSheet.tsx'
import { Counter } from '../components/Counter.tsx'
import { FilterSheet } from '../components/FilterPanel.tsx'
import { IconFilter, IconHeart, IconPencil, IconPlus } from '../components/icons.tsx'
import { GameRow } from '../components/GameRow.tsx'
import { GameSheet } from '../components/GameSheet.tsx'
import { GroupHeading } from '../components/GroupHeading.tsx'
import { Header } from '../components/Header.tsx'
import { ListPicker } from '../components/ListPicker.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { Ticker } from '../components/Ticker.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useJustAdded } from '../just-added.ts'
import { href, navigate } from '../router.ts'

/** Groups folded when a collection opens: Not interested; Not yet marked starts open (F003 FR-018). */
const FOLDED_AT_START = new Set(['group-skip'])

/**
 * One collection: games grouped by mark in the collection order, the marked groups above a line,
 * Not yet marked and Not interested folding below it (F003 FR-017, FR-018, FR-018a); filtered by
 * groups and bought (FR-009), with the games bought and the money spent (FR-008). Its actions sit in
 * the action bar (Add game, ♥, Filter) and behind the pencil after its name (F003 FR-015, FR-015a).
 */
export function Collection({ id, open }: { id: string; open?: 'game' | 'list' }) {
  const services = useServices()
  const [openGame, setOpenGame] = useState<number>()
  // the filter picked on this screen, shown at once while it is saved to the device
  const [chosen, setChosen] = useState<{ id: string; filter: Filter }>()
  // which groups are folded on this screen; not remembered between visits (docs/design.md "Group heading")
  const [folded, setFolded] = useState<{ id: string; groups: Set<string> }>()
  const [editing, setEditing] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  // F003: `?add=game|list` in the address opens Add game or BG-Tinder over the collection; closing drops the query (contracts/navigation.md)
  const closeAdding = useCallback(() => navigate({ name: 'collection', id }, { replace: true }), [id])
  const addGame = () => navigate({ name: 'collection', id, open: 'game' })
  const closeView = useCallback(() => setViewOpen(false), [])
  const [groupChoice, setGroupChoice] = useState<{ id: string; groupBy: 'mark' | 'booth' }>()
  const closeGame = useCallback(() => setOpenGame(undefined), [])
  const closeEdit = useCallback(() => setEditing(false), [])
  const justAdded = useJustAdded(id)
  const data = useStoreData(
    async store => {
      const collection = (await store.collections()).find(c => c.id === id && !c.deleted)
      const entries = (await store.entries(id)).filter(e => !e.deleted)
      const games = new Map((await store.games(entries.map(e => e.bggId))).map(g => [g.bggId, g]))
      const storedFilter = (await store.meta('activeFilter'))?.[id]
      const storedGroupBy = (await store.meta('groupBy'))?.[id]
      const lists = await store.lists()
      return { id, collection, entries, games, storedFilter, storedGroupBy, lists }
    },
    [id],
  )
  const back = href({ name: 'collections' })
  if (!data || data.id !== id) return <Header title="" />
  const { collection, entries, games, storedFilter, storedGroupBy, lists } = data
  if (!collection) {
    return (
      <>
        <Header title="Collection" />
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
  const narrowed = presetOf(filter) !== 'all' || groupBy === 'booth'
  // by mark (FR-005, collection order with two parts) or by fair hall, taken from the booth (hall view)
  const groups =
    groupBy === 'booth'
      ? groupByHall(shown, nameOf).map(g => ({ id: `group-hall-${g.key}`, heading: { key: g.key === 'none' ? 'none' : 'hall', label: g.label }, part: 'marked' as const, entries: g.entries }))
      : groupByMark(shown, nameOf).map(g => ({ id: `group-${g.mark.key}`, heading: g.mark, part: g.part, entries: g.entries }))
  const foldedGroups = folded?.id === id ? folded.groups : FOLDED_AT_START
  const toggleFold = (groupId: string) =>
    setFolded(prev => {
      const next = new Set(prev?.id === id ? prev.groups : FOLDED_AT_START)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return { id, groups: next }
    })
  const bought = boughtLine(entries)
  const boughtCount = countMarks(entries).bought
  const current = entries.find(e => e.bggId === openGame)

  return (
    <>
      {/* the name runs as a ticker when too long; the pencil right after it opens Edit collection */}
      <Header
        title={collection.name}
        heading={<Ticker text={collection.name} />}
        trailing={
          <button type="button" className="icon-btn edit-btn" aria-label={`Edit ${collection.name}`} aria-haspopup="dialog" onClick={() => setEditing(true)}>
            <IconPencil />
          </button>
        }
      />
      <main className="screen">
        {entries.length === 0 ? (
          <div className="empty">
            <div className="hex" />
            <h2>No games in {collection.name} yet</h2>
            <p>
              Tap the <b>heart</b> below to go through a BGG list and swipe the games you care about into it, or <b>Add game</b> to add a single game by its
              BoardGameGeek link.
            </p>
          </div>
        ) : (
          <>
            {/* only while something is filtered or grouped by hall: what is shown, tap to change */}
            {narrowed && (
              <button type="button" className="filter-summary" onClick={() => setViewOpen(true)}>
                <span className="visually-hidden">Filter: </span>
                {filterLabel(filter)}
                {groupBy === 'booth' && ' · by hall'} · {shown.length} {shown.length === 1 ? 'game' : 'games'}
              </button>
            )}
            {bought && (
              <p className="bought-line">
                ✅ <Counter value={boughtCount} />
                {bought.slice(`✅ ${boughtCount}`.length)}
              </p>
            )}
            <hr className="separator" />
            {shown.length === 0 && <FilterEmpty filter={filter} name={collection.name} hasMustHave={entries.some(e => e.mark === 'must_have')} />}
            {groups.map((group, i) => {
              const headingId = group.id
              // Not yet marked and Not interested fold; a line splits them from the marked games (FR-018a)
              const folds = group.part === 'rest'
              const open = !foldedGroups.has(group.id)
              const split = folds && i > 0 && groups[i - 1]?.part === 'marked'
              return (
                <Fragment key={group.id}>
                  {split && <hr className="separator" />}
                  <section className="group" aria-labelledby={headingId}>
                    <GroupHeading
                      id={headingId}
                      mark={group.heading}
                      count={group.entries.length}
                      open={folds ? open : undefined}
                      onToggle={folds ? () => toggleFold(group.id) : undefined}
                    />
                    <ul className="rows" hidden={folds && !open}>
                      {group.entries.map(entry => (
                        <li key={entry.bggId}>
                          <GameRow entry={entry} game={games.get(entry.bggId)} onOpen={() => setOpenGame(entry.bggId)} justAdded={entry.bggId === justAdded} />
                        </li>
                      ))}
                    </ul>
                  </section>
                </Fragment>
              )
            })}
          </>
        )}
      </main>
      {/* Add game · ♥ · Filter (F003 FR-015); Filter says "(active)" and turns orange while narrowed (FR-016) */}
      <ActionBar
        main={<MainButton icon={<IconHeart />} label="BG-Tinder: swipe a BGG list into this collection" href={href({ name: 'collection', id, open: 'list' })} />}
        left={<Action icon={<IconPlus />} label="Add game" onClick={addGame} />}
        right={<Action icon={<IconFilter />} label="Filter" active={narrowed} onClick={() => setViewOpen(true)} />}
      />
      {current && <GameSheet entry={current} game={games.get(current.bggId)} collection={collection} onClose={closeGame} />}
      <FilterSheet
        open={viewOpen}
        filter={filter}
        counts={groupCounts(entries, filter.bought, filter.price)}
        groupBy={groupBy}
        onChange={changeFilter}
        onGroupBy={changeGroupBy}
        onClose={closeView}
      />
      {open === 'list' && (
        <ListPicker collection={collection} entries={entries} lists={lists} onPick={list => navigate({ name: 'swipe', id, list }, { replace: true })} onClose={closeAdding} />
      )}
      {open === 'game' && <AddGameSheet collection={collection} inside={new Set(entries.map(e => e.bggId))} onClose={closeAdding} />}
      {editing && <EditCollectionSheet collection={collection} gameCount={entries.length} onClose={closeEdit} />}
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

/** "Edit collection" from the pencil: rename (1–60 characters) or delete with confirmation; the type stays fixed (FR-001a). */
function EditCollectionSheet({ collection, gameCount, onClose }: { collection: CollectionRow; gameCount: number; onClose: () => void }) {
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
    <Sheet open title="Edit collection" onClose={onClose}>
      <form className="form" onSubmit={rename}>
        <div>
          <label className="label" htmlFor={nameId}>
            Name
          </label>
          <div className="field">
            <input id={nameId} value={name} maxLength={NAME_MAX} autoComplete="off" onChange={e => setName(e.target.value)} />
          </div>
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
