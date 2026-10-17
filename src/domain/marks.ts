/** Marks say how much someone likes a game (FR-004). Order is the same everywhere (docs/design.md §4). */
export const MARKS = [
  { key: 'new', label: 'Not yet marked', emoji: '⬡' },
  { key: 'must_have', label: 'Must Have', emoji: '⭐' },
  { key: 'interested', label: 'Interested', emoji: '👀' },
  { key: 'unsure', label: 'Unsure', emoji: '🤔' },
  { key: 'poop', label: 'Poop', emoji: '💩' },
  { key: 'skip', label: 'Not interested', emoji: '🛑' },
] as const

export type Mark = (typeof MARKS)[number]['key']
export type MarkInfo = (typeof MARKS)[number]

const BY_KEY = new Map<string, MarkInfo>(MARKS.map(m => [m.key, m]))

export function isMark(value: unknown): value is Mark {
  return typeof value === 'string' && BY_KEY.has(value)
}

export function markInfo(mark: Mark): MarkInfo {
  return BY_KEY.get(mark) ?? MARKS[0]
}

export function markOrder(mark: Mark): number {
  return MARKS.findIndex(m => m.key === mark)
}
