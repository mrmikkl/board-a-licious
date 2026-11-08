import { type PrivateInfo, STATUS_KEYS, type StatusChange } from '../../src/domain/bgg-status.ts'
import { BGG_CURRENCIES, type BggAccount, type SaveRequest } from '../bgg/account.ts'
import { BggError } from '../bgg/cache.ts'
import { type BggSession, clearCookie, open, readCookie, seal, setCookie } from '../bgg/session.ts'
import { HttpError, errorResponse } from '../http.ts'
import type { RouteContext } from './context.ts'

/**
 * F008 (contracts/api.md, ADR 0009): `/api/bgg/account*`. The person's BGG session lives only in the
 * sealed HttpOnly cookie; bodies, passwords and cookies are never logged.
 */

export type AccountContext = RouteContext & { account: BggAccount; key: string | undefined }

const USER = /^[A-Za-z0-9_. -]{1,50}$/
const PASSWORD_MAX = 200

const signedOut = (clear: boolean) =>
  Response.json({ signedIn: false }, clear ? { headers: { 'Set-Cookie': clearCookie() } } : undefined)

/** The session in the request's cookie, `null` when there is none, or `'invalid'` (foreign, expired, tampered). */
async function sessionOf(ctx: AccountContext): Promise<BggSession | null | 'invalid'> {
  const value = readCookie(ctx.request)
  if (!value) return null
  return (await open(value, ctx.key, ctx.email, ctx.now)) ?? 'invalid'
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch { /* not JSON */ }
  throw new HttpError('bad_request', 'The body must be a JSON object.')
}

/** GET /api/bgg/account: reads only the cookie (no BGG request). */
export async function accountRoute(ctx: AccountContext): Promise<Response> {
  const session = await sessionOf(ctx)
  if (!session) return signedOut(false)
  if (session === 'invalid') return signedOut(true)
  return Response.json({ signedIn: true, bggUser: session.bggUser })
}

/** POST /api/bgg/account/signin: forwards the credentials once; BGG's cookies go back sealed. */
export async function signInRoute(ctx: AccountContext): Promise<Response> {
  const body = await bodyOf(ctx.request)
  const { username, password } = body
  if (typeof username !== 'string' || !USER.test(username.trim())) {
    throw new HttpError('bad_request', 'username must be a BoardGameGeek username (1–50 letters, digits, _, -, . or spaces).')
  }
  if (typeof password !== 'string' || !password || password.length > PASSWORD_MAX) throw new HttpError('bad_request', 'password is missing.')
  if (!ctx.key) throw new HttpError('bgg_unavailable', 'Signing in to BoardGameGeek is not set up on this server.')
  try {
    const signedIn = await ctx.account.signIn(username.trim(), password)
    const expiresAt = new Date(ctx.now.getTime() + signedIn.maxAgeSeconds * 1000).toISOString()
    const value = await seal({ email: ctx.email, bggUser: signedIn.bggUser, cookies: signedIn.cookies, expiresAt }, ctx.key)
    return Response.json({ signedIn: true, bggUser: signedIn.bggUser }, { headers: { 'Set-Cookie': setCookie(value, signedIn.maxAgeSeconds) } })
  } catch (error) {
    // never pass on what failed: it could hold the request
    if (error instanceof BggError) return errorResponse(error.code, error.message)
    throw new HttpError('bgg_unavailable', 'BoardGameGeek is not reachable.')
  }
}

/** POST /api/bgg/account/signout: clears the cookie (BGG is not asked). */
export async function signOutRoute(): Promise<Response> {
  return signedOut(true)
}

const bad = (message: string) => new HttpError('bad_request', message)

/** Only known keys; flags true/false, the wishlist a priority 1–5 or null. */
function statusChangeOf(value: unknown): StatusChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad('status must be an object.')
  const entries = Object.entries(value)
  if (!entries.length) throw bad('status needs at least one change.')
  for (const [key, flag] of entries) {
    if (!(STATUS_KEYS as readonly string[]).includes(key)) throw bad(`Unknown status ${JSON.stringify(key).slice(0, 40)}.`)
    if (key === 'wishlist' ? !(flag === null || (Number.isInteger(flag) && (flag as number) >= 1 && (flag as number) <= 5)) : typeof flag !== 'boolean') {
      throw bad(key === 'wishlist' ? 'wishlist must be a priority from 1 to 5, or null.' : `${key} must be true or false.`)
    }
  }
  return value as StatusChange
}

const PRICE_MAX = 10000
const ACQUIRED_FROM_MAX = 100
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function isDate(text: unknown): text is string {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

/** Price 0 < amount ≤ 10000 in a currency BGG offers, a YYYY-MM-DD date, acquiredFrom ≤ 100 characters. */
function privateInfoOf(value: unknown): PrivateInfo {
  if (!isObject(value)) throw bad('privateInfo must be an object.')
  const keys = Object.keys(value)
  if (!keys.length) throw bad('privateInfo needs at least one field.')
  if (keys.some(key => !['pricePaid', 'acquisitionDate', 'acquiredFrom'].includes(key))) throw bad('Unknown field in privateInfo.')
  const { pricePaid, acquisitionDate, acquiredFrom } = value
  if (pricePaid !== undefined) {
    if (!isObject(pricePaid) || Object.keys(pricePaid).some(key => key !== 'amount' && key !== 'currency')) throw bad('pricePaid must be { amount, currency }.')
    const { amount, currency } = pricePaid
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > PRICE_MAX) throw bad('The price paid must be more than 0 and at most 10000.')
    if (typeof currency !== 'string' || !(BGG_CURRENCIES as readonly string[]).includes(currency)) throw bad(`BoardGameGeek takes prices in ${BGG_CURRENCIES.join(', ')} only.`)
  }
  if (acquisitionDate !== undefined && !isDate(acquisitionDate)) throw bad('acquisitionDate must be a date YYYY-MM-DD.')
  if (acquiredFrom !== undefined && (typeof acquiredFrom !== 'string' || acquiredFrom.length > ACQUIRED_FROM_MAX)) throw bad('acquiredFrom must be text of at most 100 characters.')
  return value as PrivateInfo
}

function replacePriceOf(value: unknown): boolean {
  if (typeof value !== 'boolean') throw bad('replacePrice must be true or false.')
  return value
}

function saveRequestOf(body: Record<string, unknown>): SaveRequest {
  for (const key of Object.keys(body)) if (!['status', 'privateInfo', 'replacePrice'].includes(key)) throw bad('Unknown field in the body.')
  if (body.status === undefined && body.privateInfo === undefined) throw bad('Send status or privateInfo.')
  return {
    ...(body.status !== undefined ? { status: statusChangeOf(body.status) } : {}),
    ...(body.privateInfo !== undefined ? { privateInfo: privateInfoOf(body.privateInfo) } : {}),
    ...(body.replacePrice !== undefined ? { replacePrice: replacePriceOf(body.replacePrice) } : {}),
  }
}

/** POST /api/bgg/account/collection/<bggId>: the signed-in person's own collection; the cookie decides who. */
export async function saveRoute(ctx: AccountContext, id: string): Promise<Response> {
  const bggId = Number(id)
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(bggId) || bggId <= 0) throw bad('The game id must be a positive number.')
  const request = saveRequestOf(await bodyOf(ctx.request))
  const session = await sessionOf(ctx)
  if (!session || session === 'invalid') {
    return errorResponse('bgg_signed_out', 'Sign in to BoardGameGeek to save there.', session ? { 'Set-Cookie': clearCookie() } : undefined)
  }
  try {
    const saved = await ctx.account.save({ bggUser: session.bggUser, cookies: session.cookies }, bggId, request)
    if ('conflict' in saved) {
      return errorResponse('price_conflict', 'BoardGameGeek already holds another price paid.', undefined, { current: saved.conflict })
    }
    return Response.json({ bggId, status: saved.status })
  } catch (error) {
    if (error instanceof BggError && error.code === 'bgg_signed_out') return errorResponse(error.code, error.message, { 'Set-Cookie': clearCookie() })
    throw error
  }
}
