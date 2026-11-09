import { useState } from 'react'

import {
  DEFAULT_GAME_FILTER,
  DEFAULT_LENGTH_LIMITS,
  type FilterDetails,
  type GameFilter,
  type LengthLimits,
  fromStoredGameFilter,
  isDefaultGameFilter,
  matchesGame,
  toStoredGameFilter,
} from '../../domain/game-filter.ts'
import { useServices, useStoreData } from '../context.tsx'
import { hasFilterDetails } from '../hooks/game-details-state.ts'
import { type DetailsReading, useGameDetails } from '../hooks/useGameDetails.ts'
import { GameFilterSections } from './GameFilterSections.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

/**
 * F009 (docs/design.md "List filter"): the "Filter" sheet of a BGG list. Clear filters at the top and
 * the bottom, the reading line while missing details arrive (or the left-out line with Try again), the
 * game filter's sections, and Done naming how many games match. Changes apply at once.
 */
export function ListFilterSheet({
  open,
  filter,
  games: details,
  limits,
  reading,
  matching,
  onChange,
  onClose,
}: {
  open: boolean
  filter: GameFilter
  /** The details of each of the list's games; undefined while not on the device. */
  games: FilterDetails[]
  limits: LengthLimits
  reading: DetailsReading
  /** How many of the list's games pass the filter. */
  matching: number
  onChange: (filter: GameFilter) => void
  onClose: () => void
}) {
  const toast = useToast()
  const isDefault = isDefaultGameFilter(filter)
  const clear = () => {
    onChange({ ...DEFAULT_GAME_FILTER })
    toast('Filters cleared')
  }
  const left = reading.total - reading.known
  const clearButton = (top: boolean) => (
    <button type="button" className={top ? 'btn sheet-clear-top' : 'btn btn-block'} disabled={isDefault} onClick={clear}>
      Clear filters
    </button>
  )
  return (
    <Sheet open={open} title="Filter" onClose={onClose}>
      {clearButton(true)}
      <div className="game-filter-sheet">
        {reading.reading && (
          <p className="reading" role="status">
            <span className="spin-hex" aria-hidden="true" />
            <span>
              Reading game details from BoardGameGeek…{' '}
              <b>
                {reading.known} of {reading.total}
              </b>
            </span>
          </p>
        )}
        {!reading.reading && reading.failure && left > 0 && (
          <p className="fail-line">
            <span>{games(left)} {left === 1 ? 'is' : 'are'} left out: their details need a connection.</span>
            <button type="button" className="link-btn" onClick={reading.retry}>
              Try again
            </button>
          </p>
        )}
        <GameFilterSections filter={filter} onChange={onChange} games={details} limits={limits} />
      </div>
      <div className="sheet-actions sheet-actions-row">
        {clearButton(false)}
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done · {games(matching)}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * F009: the filter of one BGG list (FR-007: kept on the device in meta `listFilters` under `listKey`),
 * the details of its games, the length limits, and the reader of missing details, which runs while
 * the sheet is open or a filter is set (FR-009).
 */
export function useListFilter(listKey: string, ids: number[]) {
  const { store } = useServices()
  const idsKey = ids.join(',')
  const data = useStoreData(
    async s => {
      const list = idsKey ? idsKey.split(',').map(Number) : []
      const [filters, limits, games] = await Promise.all([s.meta('listFilters'), s.lengthLimits(), s.games(list)])
      return { listKey, stored: filters?.[listKey], limits, games: new Map(games.filter(hasFilterDetails).map(g => [g.bggId, g])) }
    },
    [listKey, idsKey],
  )
  // a change shows at once; the stored copy follows
  const [local, setLocal] = useState<{ listKey: string; filter: GameFilter }>()
  const [open, setOpen] = useState(false)
  const filter = local?.listKey === listKey ? local.filter : fromStoredGameFilter(data?.listKey === listKey ? data.stored : undefined)
  const isDefault = isDefaultGameFilter(filter)
  const reading = useGameDetails(ids, open || !isDefault)
  const limits = data?.limits ?? DEFAULT_LENGTH_LIMITS
  const games = data?.listKey === listKey ? data.games : new Map<number, FilterDetails>()

  const setFilter = (next: GameFilter) => {
    setLocal({ listKey, filter: next })
    void (async () => {
      const all = { ...(await store.meta('listFilters')) }
      if (isDefaultGameFilter(next)) delete all[listKey]
      else all[listKey] = toStoredGameFilter(next)
      await store.setMeta('listFilters', all)
    })()
  }
  const matches = (bggId: number) => isDefault || matchesGame(games.get(bggId), filter, limits)
  const sheet = (
    <ListFilterSheet
      open={open}
      filter={filter}
      games={ids.map(id => games.get(id))}
      limits={limits}
      reading={reading}
      matching={ids.filter(matches).length}
      onChange={setFilter}
      onClose={() => setOpen(false)}
    />
  )
  return { filter, isDefault, matches, clear: () => setFilter({ ...DEFAULT_GAME_FILTER }), openSheet: () => setOpen(true), sheet }
}

/** "12 of 80 games" under the name field while a filter is set or a name typed, with Clear filters. */
export function CountLine({ shown, total, filtered, onClear }: { shown: number; total: number; filtered: boolean; onClear: () => void }) {
  return (
    <div className="count-line">
      <span role="status">
        <b>{shown}</b> of {total} games
      </span>
      {filtered && (
        <button type="button" className="link-btn" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  )
}
