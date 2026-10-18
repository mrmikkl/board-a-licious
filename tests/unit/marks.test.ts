import { describe, expect, it } from 'vitest'

import { MARKS, isMark, markInfo, markOrder } from '../../src/domain/marks.ts'

describe('marks', () => {
  it('lists the marks in the fixed order', () => {
    expect(MARKS.map(m => m.key)).toEqual(['new', 'must_have', 'interested', 'unsure', 'poop', 'skip'])
  })

  it('has labels and emoji per data-model.md', () => {
    expect(MARKS.map(m => [m.label, m.emoji])).toEqual([
      ['Not yet marked', '⬡'],
      ['Must Have', '⭐'],
      ['Interested', '👀'],
      ['Unsure', '🤔'],
      ['Poop', '💩'],
      ['Not interested', '🛑'],
    ])
    expect(markInfo('skip').label).toBe('Not interested')
  })

  it('orders marks for sorting', () => {
    expect(markOrder('new')).toBeLessThan(markOrder('must_have'))
    expect(markOrder('poop')).toBeLessThan(markOrder('skip'))
  })

  it('rejects unknown keys', () => {
    expect(isMark('must_have')).toBe(true)
    expect(isMark('loved')).toBe(false)
    expect(isMark(undefined)).toBe(false)
  })
})
