/**
 * F008 (ADR 0009, research R2/R3): the only module that knows BoardGameGeek's website endpoints for
 * signing in and writing a person's own collection. Website requests carry the person's cookies and
 * never the app token; they share the BGG client's 1 request/s slot and are never cached. Passwords,
 * cookies and answers are never logged; errors carry no secrets.
 */
import { BggError, type BggClient } from './cache.ts'

const SITE = 'https://boardgamegeek.com'
const MAX_SESSION_SECONDS = 30 * 24 * 3600

export type SignedIn = {
  bggUser: string
  /** BGG's cookies as a `Cookie` header value. */
  cookies: string
  /** BGG's session lifetime, at most 30 days. */
  maxAgeSeconds: number
}

export type BggAccount = {
  /** Forwards the credentials once to BGG's login; keeps every cookie BGG sets. */
  signIn(username: string, password: string): Promise<SignedIn>
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
  }
}
