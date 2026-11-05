import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { asArray, decodeText, parseXml } from '../../worker/bgg/xml.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/bgg-xml/${name}`, import.meta.url), 'utf8')

describe('BGG XML reading (F006 research R3)', () => {
  it('reads attributes without a prefix and repeated tags as arrays', () => {
    const doc = parseXml(fixture('thing-295947-385318.xml')) as { items: { item: { id: string; type: string; name: { type: string; value: string }[] }[] } }
    expect(doc.items.item.map(i => [i.id, i.type])).toEqual([
      ['295947', 'boardgame'],
      ['385318', 'boardgameexpansion'],
      ['374341', 'rpgitem'],
    ])
    expect(doc.items.item[0]?.name[0]).toMatchObject({ type: 'primary', value: 'Cascadia' })
  })

  it('makes a single item an array too', () => {
    const doc = parseXml(fixture('thing-477191.xml')) as { items: { item: unknown[] } }
    expect(doc.items.item).toHaveLength(1)
  })

  it('decodes entities in attributes', () => {
    const doc = parseXml(fixture('search-cascad.xml')) as { items: { item: { name: { value: string }[] }[] } }
    expect(doc.items.item[0]?.name[0]?.value).toBe("The Battle at Kemble's Cascade")
  })

  it('throws on something that is not XML', () => {
    expect(() => parseXml('{"json": true}')).toThrow()
    expect(() => parseXml('')).toThrow()
  })

  it('decodes the entities BGG encodes twice and trims', () => {
    expect(decodeText('  A&mdash;B &amp; C&#039;s&#10;next&nbsp;line &ndash; &hellip;  ')).toBe("A—B & C's\nnext line – …")
    expect(decodeText(undefined)).toBe('')
  })

  it('asArray wraps single values and drops missing ones', () => {
    expect(asArray(undefined)).toEqual([])
    expect(asArray(1)).toEqual([1])
    expect(asArray([1, 2])).toEqual([1, 2])
  })
})
