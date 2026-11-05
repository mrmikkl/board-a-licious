import { describe, expect, it } from 'vitest'

import { type SearchState, initialSearch, searchReducer } from '../../src/app/hooks/search-state.ts'
import type { SearchResult } from '../../src/domain/bgg-search.ts'

const cascadia: SearchResult = { bggId: 295947, name: 'Cascadia', year: 2021, kind: 'boardgame' }
const harmonies: SearchResult = { bggId: 414317, name: 'Harmonies', year: 2024, kind: 'boardgame' }
const run = (...actions: Parameters<typeof searchReducer>[1][]) => actions.reduce<SearchState>(searchReducer, initialSearch)

describe('search state (F006 data-model "Search state", research R8)', () => {
  it('is idle for no text and asks for more for 1 letter or over 100', () => {
    expect(run({ type: 'input', text: '' })).toMatchObject({ status: 'idle' })
    expect(run({ type: 'input', text: ' c ' })).toMatchObject({ status: 'short' })
    expect(run({ type: 'input', text: 'x'.repeat(101) })).toMatchObject({ status: 'long' })
    expect(run({ type: 'input', text: 'ca' })).toMatchObject({ status: 'typing', text: 'ca' })
  })

  it('loads, then shows the results of that search', () => {
    const s = run({ type: 'input', text: 'cascad' }, { type: 'start', seq: 1 }, { type: 'results', seq: 1, results: [cascadia] })
    expect(s).toMatchObject({ status: 'done', text: 'cascad', results: [cascadia] })
  })

  it('keeps the old results dimmed while a new search loads', () => {
    const s = run({ type: 'start', seq: 1 }, { type: 'results', seq: 1, results: [cascadia] }, { type: 'input', text: 'harmon' }, { type: 'start', seq: 2 })
    expect(s).toMatchObject({ status: 'loading', previous: [cascadia], waiting: false })
  })

  it('ignores an older search that answers after a newer one (US1-7)', () => {
    const s = run({ type: 'start', seq: 1 }, { type: 'start', seq: 2 }, { type: 'results', seq: 2, results: [harmonies] }, { type: 'results', seq: 1, results: [cascadia] })
    expect(s).toMatchObject({ status: 'done', results: [harmonies] })
    expect(run({ type: 'start', seq: 1 }, { type: 'start', seq: 2 }, { type: 'failed', seq: 1, reason: 'offline' })).toMatchObject({ status: 'loading' })
  })

  it('shows a waiting state when BGG asks to wait, then the results', () => {
    const waiting = run({ type: 'start', seq: 1 }, { type: 'waiting', seq: 1 })
    expect(waiting).toMatchObject({ status: 'loading', waiting: true })
    expect(searchReducer(waiting, { type: 'results', seq: 1, results: [] })).toMatchObject({ status: 'done', results: [] })
  })

  it('reports offline and not reachable', () => {
    expect(run({ type: 'start', seq: 1 }, { type: 'failed', seq: 1, reason: 'offline' })).toMatchObject({ status: 'offline' })
    expect(run({ type: 'start', seq: 1 }, { type: 'failed', seq: 1, reason: 'unavailable' })).toMatchObject({ status: 'unavailable' })
  })

  it('typing again drops a pending answer', () => {
    const s = run({ type: 'start', seq: 1 }, { type: 'input', text: '' }, { type: 'results', seq: 1, results: [cascadia] })
    expect(s).toMatchObject({ status: 'idle' })
  })
})
