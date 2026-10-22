import { type FormEvent, Fragment, useCallback, useId, useState } from 'react'

import { groupByHall } from '../../domain/booths.ts'
import { type Collection as CollectionRow, type Entry, NAME_MAX, boughtLine, countMarks, groupByMark } from '../../domain/collection.ts'
import { type Filter, PRESETS, applyFilter, buyOff, buyOn, dropBuy, fromStored, groupCounts, isDefaultView, presetOf } from '../../domain/filter.ts'
import { matchesName } from '../../domain/search.ts'
import { deleteCollection, renameCollection, saveFilter, saveGroupBy, unbuyGame } from '../actions.ts'
import { Action, ActionBar, MainButton } from '../components/ActionBar.tsx'
import { AddGameSheet } from '../components/AddGameSheet.tsx'
import { BuySheet } from '../components/BuySheet.tsx'
import { CategorySheet } from '../components/CategorySheet.tsx'
import { Counter } from '../components/Counter.tsx'
import { type GroupBy, FilterSheet } from '../components/FilterPanel.tsx'
import { IconFilter, IconHeart, IconPencil, IconPlus, IconShowOff } from '../components/icons.tsx'
import { GameRow } from '../components/GameRow.tsx'
import { GameSheet } from '../components/GameSheet.tsx'
import { GroupHeading } from '../components/GroupHeading.tsx'
import { Header } from '../components/Header.tsx'
import { ListPicker } from '../components/ListPicker.tsx'
import { QuickFilters } from '../components/QuickFilters.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { ShowOffSheet } from '../components/ShowOffSheet.tsx'
import { Ticker } from '../components/Ticker.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useJustAdded } from '../just-added.ts'
import { href, navigate } from '../router.ts'

/** Groups folded when a collection opens: For later, Poop and Not interested (F005 R8, docs/design.md "Group heading"). */
const FOLDED_AT_START = new Set(['group-later', 'group-poop', 'group-skip'])

/**
 * One collection: games grouped by category in the collection order, the categorised games above a line,
 * No category yet and Not interested below it; or grouped by fair hall (F005 R6). Every group folds. The
 * quick filters and search narrow the games (F005 R5, R7); the Filter and group sheet holds the rest.
 * Each row has its own Buy and Category actions with their sheets (F005 R3, R4). The actions sit in the
 * action bar (Add game, ♥, Filter, Show-off) and behind the pencil after its name (F003 FR-015, FR-015a;
 * F004 FR-007).
 */
export function Collection({ id, open }: { id: string; open?: 'game' | 'list' | 'showoff' }) {
  const services = useServices()
  const toast = useToast()
  const [openGame, setOpenGame] = useState<number>()
  // the row's Buy or Category sheet, open for one game
  const [rowSheet, setRowSheet] = useState<{ kind: 'buy' | 'category'; bggId: number }>()
  // the filter picked on this screen, shown at once while it is saved to the device
  const [chosen, setChosen] = useState<{ id: string; filter: Filter }>()
  // the search text of this screen; not stored, like the folded groups
  const [search, setSearch] = useState<{ id: string; query: string }>()
  // which groups are folded on this screen; not remembered between visits (docs/design.md "Group heading")
  const [folded, setFolded] = useState<{ id: string; groups: Set<string> }>()
  const [editing, setEditing] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  // F003: `?add=game|list` in the address opens Add game or BG-Tinder over the collection; closing drops the query (contracts/navigation.md)
  const closeAdding = useCallback(() => navigate({ name: 'collection', id }, { replace: true }), [id])
  const addGame = () => navigate({ name: 'collection', id, open: 'game' })
  // F004: `?show-off` opens the Show-off sheet the same way
  const showOff = () => navigate({ name: 'collection', id, open: 'showoff' })
  const closeView = useCallback(() => setViewOpen(false), [])
  const [groupChoice, setGroupChoice] = useState<{ id: string; groupBy: GroupBy }>()
  const closeGame = useCallback(() => setOpenGame(undefined), [])
  const closeRowSheet = useCallback(() => setRowSheet(undefined), [])
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
  const filtered = applyFilter(entries, filter)
  const query = search?.id === id ? search.query : ''
  const nameOf = (e: { bggId: number }) => games.get(e.bggId)?.name ?? ''
  const displayName = (bggId: number) => games.get(bggId)?.name ?? `Game ${bggId}`
  const shown = filtered.filter(e => matchesName(nameOf(e), query))
  const groupBy = groupChoice?.id === id ? groupChoice.groupBy : (storedGroupBy ?? 'mark')
  const changeGroupBy = (next: GroupBy) => {
    setGroupChoice({ id, groupBy: next })
    void saveGroupBy(services, id, next)
  }
  // the Filter action shows "(active)" and turns orange away from the default view (docs/design.md "Filter and group")
  const isDefault = isDefaultView(filter, groupBy)
  // by category (FR-005, collection order with two parts) or by fair hall, taken from the booth (hall view)
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
  const rowEntry = rowSheet && entries.find(e => e.bggId === rowSheet.bggId)
  // Buy on a bought game un-buys it at once; on a game not bought it asks for the price (docs/design.md "Buy sheet")
  const buyRow = async (entry: Entry) => {
    if (!entry.bought) {
      setRowSheet({ kind: 'buy', bggId: entry.bggId })
      return
    }
    await unbuyGame(services, entry)
    toast(`${displayName(entry.bggId)}: not bought any more`)
  }
  const toggleBuy = () => changeFilter(filter.buy ? buyOff(filter) : buyOn(filter))
  // any change in the Filter and group sheet turns the Buy quick filter off; clearing resets everything
  const sheetGroupBy = (next: GroupBy) => {
    changeGroupBy(next)
    if (filter.buy) changeFilter(dropBuy(filter))
  }
  const clearFilters = () => {
    changeFilter(PRESETS.all)
    changeGroupBy('mark')
  }

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
            {bought && (
              <p className="bought-line">
                ✅ <Counter value={boughtCount} />
                {bought.slice(`✅ ${boughtCount}`.length)}
              </p>
            )}
            <hr className="separator" />
            <QuickFilters
              collection={collection.name}
              groupBy={groupBy}
              buy={Boolean(filter.buy)}
              count={shown.length}
              query={query}
              onGroupBy={changeGroupBy}
              onBuy={toggleBuy}
              onQuery={q => setSearch({ id, query: q })}
            />
            <hr className="separator" />
            {filtered.length === 0 && <FilterEmpty filter={filter} name={collection.name} hasMustHave={entries.some(e => e.mark === 'must_have')} />}
            {filtered.length > 0 && shown.length === 0 && (
              <div className="search-empty">
                <p>No game called “{query}” here.</p>
                <button type="button" className="btn" onClick={() => setSearch({ id, query: '' })}>
                  Clear the search
                </button>
              </div>
            )}
            {groups.map((group, i) => {
              const open = !foldedGroups.has(group.id)
              // the categories that are not yet a choice (No category yet, Not interested) sit below a line (FR-018a)
              const split = group.part === 'rest' && i > 0 && groups[i - 1]?.part === 'marked'
              return (
                <Fragment key={group.id}>
                  {split && <hr className="separator" />}
                  <section className="group" aria-labelledby={group.id}>
                    <GroupHeading id={group.id} group={group.heading} count={group.entries.length} open={open} onToggle={() => toggleFold(group.id)} />
                    <ul className="rows" hidden={!open}>
                      {group.entries.map(entry => (
                        <li key={entry.bggId}>
                          <GameRow
                            entry={entry}
                            game={games.get(entry.bggId)}
                            onOpen={() => setOpenGame(entry.bggId)}
                            onBuy={() => void buyRow(entry)}
                            onCategory={() => setRowSheet({ kind: 'category', bggId: entry.bggId })}
                            justAdded={entry.bggId === justAdded}
                          />
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
      {/* Add game · ♥ · Filter · Show-off (F003 FR-015, F004 FR-007); Filter says "(active)" and turns orange away from the default view (FR-016) */}
      <ActionBar
        main={<MainButton icon={<IconHeart />} label="BG-Tinder: swipe a BGG list into this collection" href={href({ name: 'collection', id, open: 'list' })} />}
        left={<Action icon={<IconPlus />} label="Add game" onClick={addGame} />}
        right={<Action icon={<IconFilter />} label="Filter" active={!isDefault} onClick={() => setViewOpen(true)} />}
        outer={<Action icon={<IconShowOff />} label="Show-off" onClick={showOff} />}
      />
      {current && <GameSheet entry={current} game={games.get(current.bggId)} collection={collection} onClose={closeGame} />}
      {rowEntry && rowSheet?.kind === 'buy' && <BuySheet entry={rowEntry} name={displayName(rowEntry.bggId)} onClose={closeRowSheet} />}
      {rowEntry && rowSheet?.kind === 'category' && <CategorySheet entry={rowEntry} name={displayName(rowEntry.bggId)} onClose={closeRowSheet} />}
      <FilterSheet
        open={viewOpen}
        filter={filter}
        counts={groupCounts(entries, filter.bought, filter.price)}
        groupBy={groupBy}
        onChange={changeFilter}
        onGroupBy={sheetGroupBy}
        onClear={clearFilters}
        onClose={closeView}
      />
      {open === 'list' && (
        <ListPicker collection={collection} entries={entries} lists={lists} onPick={list => navigate({ name: 'swipe', id, list }, { replace: true })} onClose={closeAdding} />
      )}
      {open === 'game' && <AddGameSheet collection={collection} inside={new Set(entries.map(e => e.bggId))} onClose={closeAdding} />}
      {open === 'showoff' && <ShowOffSheet collectionId={id} counts={countMarks(entries).byMark} onClose={closeAdding} />}
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
