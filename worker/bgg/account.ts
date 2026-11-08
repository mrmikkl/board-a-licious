/**
 * F008 (ADR 0009, research R2/R3): the only module that knows BoardGameGeek's website endpoints for
 * signing in and writing a person's own collection. Website requests carry the person's cookies and
 * never the app token; they share the BGG client's 1 request/s slot and are never cached. Passwords,
 * cookies and answers are never logged; errors carry no secrets.
 */
import { NO_STATUS, type PrivateInfo, type Status, type StatusChange, fromBggFlags } from '../../src/domain/bgg-status.ts'
import { BggError, type BggClient } from './cache.ts'
import { asArray, decodeText, parseXml } from './xml.ts'

const SITE = 'https://boardgamegeek.com'
const MAX_SESSION_SECONDS = 30 * 24 * 3600

export type SignedIn = {
  bggUser: string
  /** BGG's cookies as a `Cookie` header value. */
  cookies: string
  /** BGG's session lifetime, at most 30 days. */
  maxAgeSeconds: number
}

/** Who writes: from the sealed cookie, never from the request body. */
export type Writer = { bggUser: string; cookies: string }

/** POST /api/bgg/account/collection/<bggId> after validation (contracts/api.md). */
export type SaveRequest = { status?: StatusChange; privateInfo?: PrivateInfo; replacePrice?: boolean }

export type Price = { amount: number; currency: string }

/** The item's statuses after the save, or BGG's other price paid (nothing written; FR-031). */
export type SaveResult = { status: Status } | { conflict: Price }

/** The currencies BGG's private info form offers (ownership-editdata.html). */
export const BGG_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'YEN'] as const

export type BggAccount = {
  /** Forwards the credentials once to BGG's login; keeps every cookie BGG sets. */
  signIn(username: string, password: string): Promise<SignedIn>
  /**
   * Reads the person's item for the game, merges the sent keys into it and saves the whole group
   * (research R3). Never deletes; only on an explicit tap.
   */
  save(writer: Writer, bggId: number, request: SaveRequest): Promise<SaveResult>
}

const REJECTED = 'BoardGameGeek did not accept this username or password.'

/** `name=value` of each Set-Cookie, and the session cookie's lifetime when it gives one. */
function cookiesOf(res: Response, now: number): { cookies: string; sessionSeconds: number | null } | null {
  const pairs: string[] = []
  let sessionSeconds: number | null = null
  let session = false
  for (const line of res.headers.getSetCookie()) {
    const [pair = '', ...attributes] = line.split(';').map(part => part.trim())
    const at = pair.indexOf('=')
    const name = pair.slice(0, at)
    const value = pair.slice(at + 1)
    if (at <= 0 || !value || value === 'deleted') continue
    pairs.push(`${name}=${value}`)
    if (name !== 'SessionID') continue
    session = true
    for (const attribute of attributes) {
      const [key = '', ...rest] = attribute.split('=')
      const text = rest.join('=')
      if (/^max-age$/i.test(key) && Number.isFinite(Number(text))) sessionSeconds = Number(text)
      else if (/^expires$/i.test(key) && sessionSeconds === null && Number.isFinite(Date.parse(text))) sessionSeconds = Math.floor((Date.parse(text) - now) / 1000)
    }
  }
  return session ? { cookies: pairs.join('; '), sessionSeconds } : null
}

const SIGNED_OUT = 'Your BoardGameGeek sign-in has expired. Sign in again.'
const REFUSED = 'BoardGameGeek did not take the change.'

/** BGG's form fields for the statuses, in the order of BGG's dialog (save-status.form). */
const FLAGS: [keyof Status, string][] = [
  ['own', 'own'], ['prevOwned', 'prevowned'], ['forTrade', 'fortrade'], ['wantInTrade', 'want'],
  ['wantToPlay', 'wanttoplay'], ['wantToBuy', 'wanttobuy'], ['wishlist', 'wishlist'], ['preordered', 'preordered'],
]
/** BGG's dialog sends a priority even when the wishlist is unticked (1, as recorded for a new game). */
const DEFAULT_PRIORITY = 1

type Item = { collid: string | null; status: Status }

/** Every field of BGG's private info form; a save sends them all, or BGG wipes the missing ones. */
const OWNERSHIP_FIELDS = ['pricepaid', 'pp_currency', 'currvalue', 'cv_currency', 'quantity', 'acquisitiondate', 'acquiredfrom', 'invdate', 'invlocation', 'privatecomment'] as const
type Ownership = Record<(typeof OWNERSHIP_FIELDS)[number], string>
const EMPTY_OWNERSHIP = Object.fromEntries(OWNERSHIP_FIELDS.map(field => [field, ''])) as Ownership

const attribute = (tag: string, name: string) => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)"|([^\\s>]+))`, 'i').exec(tag)
  return match ? decodeText(match[1] ?? match[2] ?? match[3]) : undefined
}

/** The values of BGG's private info form (inputs, selected currencies, the comment), or null when it is not there. */
function parseOwnership(html: string): Ownership | null {
  const values: Record<string, string> = {}
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    const name = attribute(tag, 'name')
    if (name && !(name in values)) values[name] = attribute(tag, 'value') ?? ''
  }
  if (values.fieldname !== 'ownership' || !('pricepaid' in values)) return null
  for (const [, name = '', options = ''] of html.matchAll(/<select\b[^>]*\bname=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/select>/gi)) {
    const selected = /<option\b[^>]*\sselected\b[^>]*>/i.exec(options)?.[0]
    values[name] = selected ? (attribute(selected, 'value') ?? '') : ''
  }
  const comment = /<textarea\b[^>]*\bname=['"]privatecomment['"][^>]*>([\s\S]*?)<\/textarea>/i.exec(html)?.[1]
  values.privatecomment = decodeText(comment ?? '')
  return Object.fromEntries(OWNERSHIP_FIELDS.map(field => [field, values[field] ?? ''])) as Ownership
}

/** BGG's price paid, when it holds one. */
function priceOf(form: Ownership): Price | null {
  const text = form.pricepaid.trim().replace(',', '.')
  const amount = Number(text)
  return text && Number.isFinite(amount) && amount > 0 ? { amount, currency: form.pp_currency } : null
}
const samePrice = (a: Price, b: Price) => Math.abs(a.amount - b.amount) < 0.005 && a.currency === b.currency
type CollectionItem = { objecttype?: string; objectid?: string; collid?: string; status?: Record<string, string> }

const sameStatus = (a: Status, b: Status) => FLAGS.every(([key]) => a[key] === b[key])

function readXml(text: string): Record<string, unknown> {
  try {
    return parseXml(text)
  } catch {
    throw new BggError('bgg_unavailable', 'BoardGameGeek sent something unexpected.')
  }
}

/** A website answer: an expired session (login redirect, 401/403) or any other error is thrown. */
async function answerOf(res: Response): Promise<string> {
  const location = res.headers.get('Location') ?? ''
  if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400 && /\/login/i.test(location))) {
    throw new BggError('bgg_signed_out', SIGNED_OUT)
  }
  if (res.status === 429) throw new BggError('bgg_unavailable', 'BoardGameGeek asks to slow down.')
  if (!res.ok) throw new BggError('bgg_refused', REFUSED)
  const text = await res.text()
  if (/must (be )?log(ged)? ?in|please (log|sign) ?in|not (logged|signed) in/i.test(text)) throw new BggError('bgg_signed_out', SIGNED_OUT)
  return text
}

export function createBggAccount(client: BggClient, now: () => number = Date.now): BggAccount {
  return {
    async signIn(username, password) {
      const res = await client.website(`${SITE}/login/api/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ credentials: { username, password } }),
      })
      if (res.status === 429 || res.status >= 500) throw new BggError('bgg_unavailable', `BoardGameGeek answered ${res.status}.`)
      const found = res.status === 204 ? cookiesOf(res, now()) : null
      if (!found) throw new BggError('bgg_signed_out', REJECTED)
      const seconds = Math.min(MAX_SESSION_SECONDS, found.sessionSeconds ?? MAX_SESSION_SECONDS)
      if (seconds <= 0) throw new BggError('bgg_signed_out', REJECTED)
      return { bggUser: username.trim().toLowerCase(), cookies: found.cookies, maxAgeSeconds: seconds }
    },

    async save(writer, bggId, request) {
      let item = await readItem(writer.bggUser, bggId)
      const status: Status = { ...item.status, ...request.status }
      const { privateInfo } = request
      // decide a price conflict before writing anything
      let form: Ownership | null = null
      let keepPrivateInfo = false
      if (privateInfo && item.collid) {
        form = await readOwnership(writer, bggId, item.collid)
        const current = priceOf(form)
        if (privateInfo.pricePaid && current && !samePrice(current, privateInfo.pricePaid)) {
          if (request.replacePrice === undefined) return { conflict: current }
          keepPrivateInfo = !request.replacePrice
        }
      }
      if (!item.collid || !sameStatus(item.status, status)) {
        await saveStatus(writer, bggId, item.collid, status)
        // a new game: BGG gives it a collid, read back for the private info save
        if (!item.collid && request.privateInfo) {
          item = await readItem(writer.bggUser, bggId)
          if (!item.collid) throw new BggError('bgg_refused', REFUSED)
        }
      }
      if (privateInfo && !keepPrivateInfo && item.collid) await saveOwnership(writer, bggId, item.collid, form ?? EMPTY_OWNERSHIP, privateInfo)
      return { status }
    },
  }

  /**
   * The person's item through the official API (token, no cookies, never cached): its first copy's collid
   * and statuses, or none. Not among the games → also asked among the expansions.
   */
  async function readItem(bggUser: string, bggId: number): Promise<Item> {
    const base = `${SITE}/xmlapi2/collection?username=${encodeURIComponent(bggUser.toLowerCase())}&id=${bggId}`
    for (const url of [base, `${base}&subtype=boardgameexpansion`]) {
      const doc = readXml(await client.getXml(url, 0, { fresh: true, noStore: true, preparing: true }))
      if (doc.errors) throw new BggError('bgg_unavailable', 'BoardGameGeek could not send this collection.')
      const items = asArray((doc.items as { item?: CollectionItem[] } | undefined)?.item)
      const found = items.find(i => i.objecttype === 'thing' && Number(i.objectid) === bggId)
      if (found) {
        const flags = found.status ?? {}
        return {
          collid: found.collid || null,
          status: fromBggFlags({
            own: flags.own, prevowned: flags.prevowned, fortrade: flags.fortrade, want: flags.want, wanttoplay: flags.wanttoplay,
            wanttobuy: flags.wanttobuy, wishlist: flags.wishlist, wishlistpriority: flags.wishlistpriority, preordered: flags.preordered,
          }),
        }
      }
    }
    return { collid: null, status: NO_STATUS }
  }

  /** One POST to BGG's collection save with the person's cookies (never the token). */
  async function post(writer: Writer, form: [string, string][]): Promise<string> {
    const res = await client.website(`${SITE}/geekcollection.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'text/html, */*', Cookie: writer.cookies },
      body: new URLSearchParams(form).toString(),
    })
    return answerOf(res)
  }

  /** The whole status group: only ticked statuses, plus the priority (save-status.form). */
  async function saveStatus(writer: Writer, bggId: number, collid: string | null, status: Status): Promise<void> {
    await post(writer, [
      ['fieldname', 'status'], ['collid', collid ?? ''], ['objecttype', 'thing'], ['objectid', String(bggId)],
      ...FLAGS.filter(([key]) => (key === 'wishlist' ? status.wishlist !== null : status[key])).map(([, field]): [string, string] => [field, '1']),
      ['B1', 'Cancel'],
      ['wishlistpriority', String(status.wishlist ?? DEFAULT_PRIORITY)],
      ['ajax', '1'], ['action', 'savedata'],
    ])
  }

  /** BGG's private info form for the item (ownership-editdata.url), with the person's cookies. */
  async function readOwnership(writer: Writer, bggId: number, collid: string): Promise<Ownership> {
    const query = new URLSearchParams({ cellid: '1', collid, fieldname: 'ownership', objecttype: 'thing', objectid: String(bggId), ajax: '1', action: 'editdata' })
    const res = await client.website(`${SITE}/geekcollection.php?${query}`, { method: 'GET', headers: { Accept: 'text/html, */*', Cookie: writer.cookies } })
    const form = parseOwnership(await answerOf(res))
    if (!form) throw new BggError('bgg_refused', REFUSED)
    return form
  }

  /**
   * The whole private info group (save-ownership.form): every value BGG holds, with only price paid,
   * currency, acquisition date and acquired from changed. The answer must show the price sent.
   */
  async function saveOwnership(writer: Writer, bggId: number, collid: string, form: Ownership, info: PrivateInfo): Promise<void> {
    const next: Ownership = {
      ...form,
      ...(info.pricePaid ? { pricepaid: String(info.pricePaid.amount), pp_currency: info.pricePaid.currency } : {}),
      ...(info.acquisitionDate ? { acquisitiondate: info.acquisitionDate } : {}),
      ...(info.acquiredFrom !== undefined ? { acquiredfrom: info.acquiredFrom } : {}),
    }
    const answer = await post(writer, [
      ['fieldname', 'ownership'], ['collid', collid], ['objecttype', 'thing'], ['objectid', String(bggId)],
      ['pricepaid', next.pricepaid], ['currvalue', next.currvalue], ['quantity', next.quantity],
      ['acquisitiondate', next.acquisitiondate], ['dateinput', next.acquisitiondate], ['acquiredfrom', next.acquiredfrom],
      ['invdate', next.invdate], ['dateinput', next.invdate], ['invlocation', next.invlocation], ['B1', 'Cancel'],
      ['pp_currency', next.pp_currency], ['cv_currency', next.cv_currency], ['privatecomment', next.privatecomment],
      ['ajax', '1'], ['action', 'savedata'],
    ])
    const shown = info.pricePaid ? answer.includes(info.pricePaid.amount.toFixed(2)) : /collectiontable_ownership/.test(answer)
    if (!shown) throw new BggError('bgg_refused', REFUSED)
  }
}
