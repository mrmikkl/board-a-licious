import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type BggSession, open, seal } from '../../worker/bgg/session.ts'
import type { Db } from '../../worker/db/db.ts'
import { ANNA, type FakeBgg, json, testApp } from './app-helpers.ts'

/**
 * F008 US3–US5 (ADR 0009, research R2/R3): signing in to BGG and writing the person's own collection
 * through BGG's website with their own session, against the recordings in tests/fixtures/bgg-web/.
 */

const web = (name: string) => readFileSync(new URL(`../fixtures/bgg-web/${name}`, import.meta.url), 'utf8')
const KEY = Buffer.from(new Uint8Array(32).fill(7)).toString('base64')
const OTHER_KEY = Buffer.from(new Uint8Array(32).fill(9)).toString('base64')
const ENV = { BGG_SESSION_KEY: KEY, BGG_TOKEN: 'test-token' }
const NOW = '2026-11-08T12:00:00.000Z'
const PASSWORD = 'pa55-w0rd-secret'
const SESSION_ID = 'sess-value-0123456789'
const db = {} as Db

type Call = { url: URL; method: string; headers: Headers; body: string }

/** A fake BGG that records method, headers and body of every request. */
function fakeBgg(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const bgg: FakeBgg = (url, init) => {
    const call = { url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: typeof init?.body === 'string' ? init.body : String(init?.body ?? '') }
    calls.push(call)
    return answer(call)
  }
  return { bgg, calls }
}

/** The recorded sign-in answer: 204, empty body, the session as Set-Cookie (signin.json). */
function signedIn() {
  const headers = new Headers()
  headers.append('Set-Cookie', `SessionID=${SESSION_ID}; expires=Mon, 07-Dec-2026 12:00:00 GMT; Max-Age=2505600; path=/; domain=.boardgamegeek.com; secure; HttpOnly`)
  headers.append('Set-Cookie', 'bggusername=anna; path=/; domain=.boardgamegeek.com; secure')
  return new Response(null, { status: 204, headers })
}

/** The rejections we could not record (research R2), built from the fixtures. */
function rejected(name: string) {
  const { response } = JSON.parse(web(name)) as { response: { status: number; body: unknown } }
  return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': 'application/json' } })
}

const signIn = (body: unknown = { username: 'Anna', password: PASSWORD }) => json(body)

const cookieOf = (res: Response) => res.headers.get('Set-Cookie') ?? ''
const sealedValue = (res: Response) => /^bal_bgg=([^;]*)/.exec(cookieOf(res))?.[1] ?? ''

const session = (over: Partial<BggSession> = {}): BggSession => ({
  email: ANNA,
  bggUser: 'anna',
  cookies: `SessionID=${SESSION_ID}; bggusername=anna`,
  expiresAt: '2026-12-01T00:00:00.000Z',
  ...over,
})
const withCookie = async (init: RequestInit = {}, over: Partial<BggSession> = {}, key = KEY): Promise<RequestInit> => ({
  ...init,
  headers: { ...(init.headers as Record<string, string> | undefined), Cookie: `other=1; bal_bgg=${await seal(session(over), key)}` },
})

/** Every console line written during a test, to prove nothing secret is logged. */
let logged: string[] = []
beforeEach(() => {
  logged = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(a => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    })
  }
})
afterEach(() => vi.restoreAllMocks())

const noSecrets = async (res: Response) => {
  const text = `${logged.join('\n')}\n${await res.clone().text()}`
  for (const secret of [PASSWORD, SESSION_ID, 'Cookie:', 'bal_bgg=']) expect(text).not.toContain(secret)
}

describe('POST /api/bgg/account/signin (US3, research R2)', () => {
  it('forwards the credentials once to BGG\'s login as recorded, without the app token', async () => {
    const { bgg, calls } = fakeBgg(() => signedIn())
    await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn())
    const recorded = JSON.parse(web('signin.json')).request
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url.href).toBe(recorded.url)
    expect(calls[0]?.method).toBe(recorded.method)
    expect(calls[0]?.headers.get('Content-Type')).toBe(recorded.contentType)
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({ credentials: { username: 'Anna', password: PASSWORD } })
    expect(calls[0]?.headers.get('Authorization')).toBeNull()
    expect(calls[0]?.headers.get('Cookie')).toBeNull()
  })

  it('answers 200 { signedIn, bggUser } with the sealed, HttpOnly cookie holding BGG\'s cookies', async () => {
    const { bgg } = fakeBgg(() => signedIn())
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signedIn: true, bggUser: 'anna' })
    const cookie = cookieOf(res)
    expect(cookie).toMatch(/^bal_bgg=[A-Za-z0-9_-]+; Path=\/api\/bgg\/account; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+$/)
    const opened = await open(sealedValue(res), KEY, ANNA, new Date(NOW))
    expect(opened).toMatchObject({ email: ANNA, bggUser: 'anna' })
    expect(opened?.cookies).toBe(`SessionID=${SESSION_ID}; bggusername=anna`)
    // BGG's session lasts 29 days here: the app cookie does not outlive it
    expect(Number(/Max-Age=(\d+)/.exec(cookie)?.[1])).toBeLessThanOrEqual(2505600)
    expect(cookie).not.toContain(SESSION_ID)
  })

  it.each(['signin-rejected-401.json', 'signin-rejected-200.json'])('answers 401 bgg_signed_out without a cookie when BGG rejects (%s)', async name => {
    const { bgg } = fakeBgg(() => rejected(name))
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn())
    expect(res.status).toBe(401)
    expect(res.headers.get('Set-Cookie')).toBeNull()
    expect(await res.json()).toEqual({ error: 'bgg_signed_out', message: 'BoardGameGeek did not accept this username or password.', retryable: false })
  })

  it('treats a 204 without SessionID as rejected', async () => {
    const { bgg } = fakeBgg(() => new Response(null, { status: 204, headers: { 'Set-Cookie': 'bggusername=anna; path=/' } }))
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn())
    expect(res.status).toBe(401)
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it.each([
    ['unreachable', () => Promise.reject(new TypeError('network down'))],
    ['5xx', () => new Response('oops', { status: 503 })],
    ['429', () => new Response('slow down', { status: 429 })],
  ] as const)('answers 502 bgg_unavailable when BGG is %s', async (_, answer) => {
    const { bgg } = fakeBgg(answer)
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn())
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('bgg_unavailable')
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it.each([
    ['no username', { password: PASSWORD }],
    ['no password', { username: 'anna' }],
    ['empty password', { username: 'anna', password: '' }],
    ['bad username', { username: 'a/b', password: PASSWORD }],
  ])('answers 400 for %s without asking BGG', async (_, body) => {
    const { bgg, calls } = fakeBgg(() => signedIn())
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', signIn(body))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('never logs or answers the password, BGG\'s cookie values or the Cookie header, also when failing', async () => {
    for (const answer of [() => signedIn(), () => rejected('signin-rejected-401.json'), () => Promise.reject(new Error(`boom ${PASSWORD}`)), () => new Response('x', { status: 500 })]) {
      const { bgg } = fakeBgg(answer)
      const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signin', await withCookie(signIn()))
      await noSecrets(res)
      expect(cookieOf(res)).not.toContain(SESSION_ID)
    }
  })
})

describe('GET /api/bgg/account (US3)', () => {
  it('reads only the cookie: signed in as the sealed BGG user', async () => {
    const { bgg, calls } = fakeBgg(() => signedIn())
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account', await withCookie())
    await noSecrets(res)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signedIn: true, bggUser: 'anna' })
    expect(calls).toHaveLength(0)
  })

  it('without a cookie: { signedIn: false }', async () => {
    const res = await testApp(db, { env: ENV, now: NOW })('/api/bgg/account')
    expect(await res.json()).toEqual({ signedIn: false })
  })

  it.each([
    ['sealed for another email', { email: 'bert@example.com' }, KEY],
    ['expired', { expiresAt: '2026-11-01T00:00:00.000Z' }, KEY],
    ['under another key', {}, OTHER_KEY],
  ] as const)('a cookie %s: { signedIn: false } and the cookie cleared', async (_, over, key) => {
    const res = await testApp(db, { env: ENV, now: NOW })('/api/bgg/account', await withCookie({}, over, key))
    expect(await res.json()).toEqual({ signedIn: false })
    expect(cookieOf(res)).toMatch(/^bal_bgg=; Path=\/api\/bgg\/account; HttpOnly; Secure; SameSite=Strict; Max-Age=0$/)
  })
})

describe('POST /api/bgg/account/signout (US3)', () => {
  it('clears the cookie without asking BGG', async () => {
    const { bgg, calls } = fakeBgg(() => signedIn())
    const res = await testApp(db, { bgg, env: ENV, now: NOW })('/api/bgg/account/signout', await withCookie({ method: 'POST' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signedIn: false })
    expect(cookieOf(res)).toMatch(/^bal_bgg=; .*Max-Age=0$/)
    expect(calls).toHaveLength(0)
  })
})
