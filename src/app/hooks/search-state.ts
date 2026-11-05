import { type SearchResult, searchQuery } from '../../domain/bgg-search.ts'

/** F006 research R8: what the Search place (and Add game) shows; `seq` is the newest search started. */
export type SearchState = { seq: number; text: string } & (
  | { status: 'idle' | 'short' | 'long' | 'typing' }
  | { status: 'loading'; previous: SearchResult[] | null; waiting: boolean }
  | { status: 'done'; results: SearchResult[] }
  | { status: 'offline' | 'unavailable' }
)

export type SearchAction =
  | { type: 'input'; text: string }
  | { type: 'start'; seq: number }
  | { type: 'waiting'; seq: number }
  | { type: 'results'; seq: number; results: SearchResult[] }
  | { type: 'failed'; seq: number; reason: 'offline' | 'unavailable' }

export const initialSearch: SearchState = { seq: 0, text: '', status: 'idle' }

const shown = (state: SearchState) => (state.status === 'done' ? state.results : state.status === 'loading' ? state.previous : null)

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'input': {
      // a new text makes any search on its way stale: its answer is dropped by its seq
      const query = searchQuery(action.text)
      const status = action.text.trim() === '' ? 'idle' : query.ok ? 'typing' : query.reason
      const seq = state.seq + 1
      return status === 'typing' && shown(state) ? { seq, text: action.text, status: 'loading', previous: shown(state), waiting: false } : { seq, text: action.text, status }
    }
    case 'start':
      return { seq: action.seq, text: state.text, status: 'loading', previous: shown(state), waiting: false }
    default:
      if (action.seq !== state.seq) return state
      if (action.type === 'waiting') return state.status === 'loading' ? { ...state, waiting: true } : state
      if (action.type === 'results') return { seq: state.seq, text: state.text, status: 'done', results: action.results }
      return { seq: state.seq, text: state.text, status: action.reason }
  }
}
