import { describe, expect, it } from 'vitest'

import { MARKS, isMark, markInfo, markOrder } from '../../src/domain/marks.ts'

describe('marks', () => {
  it('lists the marks in the fixed order', () => {
    expect(MARKS.map(m => m.key)).toEqual(['new', 'must_have', 'interested', 'unsure', 'later', 'poop', 'skip'])
  })

  it('has labels and emoji per data-model.md', () => {
    expect(MARKS.map(m => [m.label, m.emoji])).toEqual([
      ['No category yet', '⬡'],
      ['Must Have', '⭐'],
      ['Interested', '👀'],
      ['Unsure', '🤔'],
      ['For later', '⏳'],
      ['Poop', '💩'],
      ['Not interested', '🛑'],
    ])
    expect(markInfo('skip').label).toBe('Not interested')
  })

  it('orders marks for sorting', () => {
    expect(markOrder('new')).toBeLessThan(markOrder('must_have'))
    expect(markOrder('poop')).toBeLessThan(markOrder('skip'))
    // F005: For later sits between Unsure and Poop
    expect(markOrder('unsure')).toBeLessThan(markOrder('later'))
    expect(markOrder('later')).toBeLessThan(markOrder('poop'))
  })

  it('rejects unknown keys', () => {
    expect(isMark('must_have')).toBe(true)
    expect(isMark('later')).toBe(true)
    expect(isMark('loved')).toBe(false)
    expect(isMark(undefined)).toBe(false)
  })
})
