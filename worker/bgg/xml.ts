import { XMLParser } from 'fast-xml-parser'

/** Tags BGG repeats; always arrays, even when an answer holds only one (research R3). */
const REPEATED = new Set(['item', 'link', 'name', 'rank'])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  htmlEntities: true,
  // tags only: `name` is also an attribute (e.g. of a poll), which must stay a plain value
  isArray: (name, _path, _leaf, isAttribute) => !isAttribute && REPEATED.has(name),
})

/** The official API's XML as plain objects; throws when the text holds no XML document. */
export function parseXml(text: string): Record<string, unknown> {
  const doc = parser.parse(text) as Record<string, unknown>
  if (!Object.keys(doc).some(key => key !== '?xml')) throw new Error('No XML document.')
  return doc
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', times: '×', eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä',
}

/** BGG encodes some entities twice (`&amp;mdash;`); this decodes what is left and trims. */
export function decodeText(text: unknown): string {
  if (typeof text !== 'string' && typeof text !== 'number') return ''
  return String(text)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole)
    .trim()
}

/** A value that may be missing, single or repeated, as an array. */
export const asArray = <T>(value: T | T[] | undefined | null): T[] => (value == null ? [] : Array.isArray(value) ? value : [value])
