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

// ---------------------------------------------------------------------------------------------
// Saving (US4, research R3 "Found in T001")

const GAME = 425029
const COLLID = '123456789'
const STATUS_ANSWER = `<table cellspacing=1 cellpadding=1 width='100%' class='collectiontable_status'><tr><td>Owned</td></tr></table>`
const NONE = { own: false, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null }

const pairs = (form: string) => [...new URLSearchParams(form.trim())]
const isRead = (c: Call) => c.url.pathname === '/xmlapi2/collection'
const isWrite = (c: Call) => c.method === 'POST' && c.url.pathname === '/geekcollection.php'
const fieldOf = (c: Call) => new URLSearchParams(c.body).get('fieldname')

/**
 * BGG for one game: the official API's item (`items` before the first status save, `after` from then on),
 * the status save, the private info form and its save.
 */
function site(options: {
  items?: string
  after?: string
  status?: (call: Call) => Response
  editdata?: string
  ownership?: (call: Call) => Response
} = {}) {
  let saved = false
  return fakeBgg(call => {
    if (isRead(call)) return new Response(saved ? (options.after ?? web('collection-item.xml')) : (options.items ?? web('collection-item.xml')), { headers: { 'Content-Type': 'text/xml' } })
    if (call.url.pathname === '/geekcollection.php' && call.method === 'GET') return new Response(options.editdata ?? web('ownership-editdata.html'))
    if (isWrite(call) && fieldOf(call) === 'status') {
      const res = options.status?.(call) ?? new Response(STATUS_ANSWER)
      if (res.ok) saved = true
      return res
    }
    if (isWrite(call) && fieldOf(call) === 'ownership') return options.ownership?.(call) ?? new Response(web('save-ownership.html'))
    throw new Error(`unexpected BGG call ${call.method} ${call.url}`)
  })
}

/** The item as BGG has it, with some statuses set on the website. */
const itemWith = (flags: string) => web('collection-item.xml').replace(/<status [^/]*\/>/, `<status ${flags} lastmodified="2026-11-08 05:12:44" />`)

const save = async (body: unknown, over?: Partial<BggSession>) => withCookie(json(body), over)
const path = `/api/bgg/account/collection/${GAME}`

describe('POST /api/bgg/account/collection/<bggId>: statuses (US4, research R3)', () => {
  it('reads the item through the official API (token, no cookies), then saves the whole status group as recorded', async () => {
    const { bgg, calls } = site()
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true, wishlist: 2 } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ bggId: GAME, status: { ...NONE, own: true, wishlist: 2 } })

    expect(calls).toHaveLength(2)
    const [read, write] = calls as [Call, Call]
    expect(read.url.href).toBe(`https://boardgamegeek.com/xmlapi2/collection?username=anna&id=${GAME}`)
    expect(read.headers.get('Authorization')).toBe('Bearer test-token')
    expect(read.headers.get('Cookie')).toBeNull()

    expect(write.url.href).toBe('https://boardgamegeek.com/geekcollection.php')
    expect(write.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded; charset=UTF-8')
    expect(write.headers.get('Cookie')).toBe(`SessionID=${SESSION_ID}; bggusername=anna`)
    expect(write.headers.get('Authorization')).toBeNull()
    expect(pairs(write.body)).toEqual(pairs(web('save-status.form')))
  })

  it('merges only the sent keys: statuses set on the website meanwhile survive', async () => {
    const { bgg, calls } = site({ items: itemWith('own="0" prevowned="0" fortrade="1" want="0" wanttoplay="1" wanttobuy="0" wishlist="1" wishlistpriority="4" preordered="0"') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
    expect(await res.json()).toEqual({ bggId: GAME, status: { ...NONE, own: true, forTrade: true, wantToPlay: true, wishlist: 4 } })
    const form = new URLSearchParams(calls.find(isWrite)?.body)
    expect([...form.keys()].filter(k => form.get(k) === '1' && k !== 'ajax')).toEqual(['own', 'fortrade', 'wanttoplay', 'wishlist'])
    expect(form.get('wishlistpriority')).toBe('4')
  })

  it('unticks a status by leaving it out of the group', async () => {
    const { bgg, calls } = site({ items: itemWith('own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="1" wishlistpriority="2" preordered="0"') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { wishlist: null } }))
    expect((await res.json()).status).toEqual({ ...NONE, own: true })
    const form = new URLSearchParams(calls.find(isWrite)?.body)
    expect(form.get('own')).toBe('1')
    expect(form.has('wishlist')).toBe(false)
  })

  it('maps every key to BGG\'s field names (Want in trade = want)', async () => {
    const all = { own: true, prevOwned: true, forTrade: true, wantInTrade: true, wantToPlay: true, wantToBuy: true, wishlist: 5, preordered: true }
    const { bgg, calls } = site()
    await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: all }))
    const form = pairs(calls.find(isWrite)?.body ?? '')
    expect(form.filter(([, v]) => v === '1').map(([k]) => k)).toEqual(['own', 'prevowned', 'fortrade', 'want', 'wanttoplay', 'wanttobuy', 'wishlist', 'preordered', 'ajax'])
    expect(form).toContainEqual(['wishlistpriority', '5'])
  })

  it('adds a game not yet in the collection with an empty collid, as recorded', async () => {
    const { bgg, calls } = site({ items: web('collection-item-none.xml') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toEqual({ ...NONE, own: true })
    // not in the games: also looked for among the expansions
    expect(calls.filter(isRead).map(c => c.url.search)).toEqual([`?username=anna&id=${GAME}`, `?username=anna&id=${GAME}&subtype=boardgameexpansion`])
    expect(pairs(calls.find(isWrite)?.body ?? '')).toEqual(pairs(web('save-status-new.form')))
  })

  it('writes nothing when the change is what BGG already has', async () => {
    const { bgg, calls } = site({ items: itemWith('own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0"') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
    expect(res.status).toBe(200)
    expect(calls.filter(isWrite)).toHaveLength(0)
  })

  it('never sends a delete and only ever saves (one read, one write per call); nothing is cached', async () => {
    const { bgg, calls } = site()
    const app = testApp(db, { bgg, env: ENV, now: NOW })
    await app(path, await save({ status: { own: true } }))
    await app(path, await save({ status: { wishlist: 3 } }))
    expect(calls.filter(isRead)).toHaveLength(2)
    expect(calls.filter(isWrite)).toHaveLength(2)
    for (const call of calls.filter(c => c.url.pathname === '/geekcollection.php')) {
      expect(new URLSearchParams(call.body || call.url.search).get('action')).toMatch(/^(savedata|editdata)$/)
      expect(`${call.url}${call.body}`).not.toMatch(/delete/i)
    }
  })

  it.each([
    ['no status and no privateInfo', {}],
    ['an empty status', { status: {} }],
    ['an unknown key', { status: { owned: true } }],
    ['an unknown top-level key', { status: { own: true }, user: 'bert' }],
    ['a non-boolean flag', { status: { own: 'yes' } }],
    ['priority 0', { status: { wishlist: 0 } }],
    ['priority 6', { status: { wishlist: 6 } }],
    ['priority 2.5', { status: { wishlist: 2.5 } }],
    ['priority as text', { status: { wishlist: '2' } }],
  ])('answers 400 for %s without asking BGG', async (_, body) => {
    const { bgg, calls } = site()
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('bad_request')
    expect(calls).toHaveLength(0)
  })

  it.each(['0', 'abc', '-1'])('answers 400 for the game id %s', async id => {
    const { bgg, calls } = site()
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(`/api/bgg/account/collection/${id}`, await save({ status: { own: true } }))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('answers 401 bgg_signed_out without a cookie, asking nobody', async () => {
    const { bgg, calls } = site()
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, json({ status: { own: true } }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('bgg_signed_out')
    expect(calls).toHaveLength(0)
  })

  it('answers 401 and clears a cookie sealed for another person', async () => {
    const { bgg, calls } = site()
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }, { email: 'bert@example.com' }))
    expect(res.status).toBe(401)
    expect(cookieOf(res)).toMatch(/^bal_bgg=; .*Max-Age=0$/)
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['a redirect to the login page', () => new Response(null, { status: 302, headers: { Location: 'https://boardgamegeek.com/login?redirect_server=1' } })],
    ['401', () => new Response('', { status: 401 })],
    ['403', () => new Response('', { status: 403 })],
  ])('answers 401 bgg_signed_out and clears the cookie when BGG answers the save with %s', async (_, status) => {
    const { bgg } = site({ status })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('bgg_signed_out')
    expect(cookieOf(res)).toMatch(/^bal_bgg=; .*Max-Age=0$/)
  })

  it.each([
    ['500', () => new Response('oops', { status: 500 })],
    ['another redirect', () => new Response(null, { status: 302, headers: { Location: 'https://boardgamegeek.com/' } })],
  ])('answers 502 bgg_refused when BGG answers the save with %s', async (_, status) => {
    const { bgg } = site({ status })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'bgg_refused', message: 'BoardGameGeek did not take the change.', retryable: true })
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('answers 502 bgg_refused when a new game still has no collid after saving', async () => {
    const { bgg } = site({ items: web('collection-item-none.xml'), after: web('collection-item-none.xml') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true }, privateInfo: { pricePaid: { amount: 45, currency: 'EUR' } } }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('bgg_refused')
  })

  it('never logs the session or answers with it', async () => {
    for (const status of [undefined, () => new Response('oops', { status: 500 }), () => Promise.reject(new Error('down'))] as const) {
      const { bgg } = site({ status: status as ((call: Call) => Response) | undefined })
      const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true } }))
      await noSecrets(res)
    }
  })
})

describe('BGG account writes share the throttle slot (ADR 0009)', () => {
  it('waits a second between the item read and the save', async () => {
    const { createBgg } = await import('../../worker/bgg/routing.ts')
    const { memoryCache } = await import('../../worker/bgg/cache.ts')
    let t = 0
    const times: number[] = []
    const { bgg } = site()
    const { account } = createBgg({
      fetch: async (input, init) => {
        times.push(t)
        return bgg(new URL(String(input)), init)
      },
      cache: memoryCache(() => t),
      now: () => t,
      sleep: async ms => void (t += ms),
      token: 'test-token',
      log: () => {},
    })
    await account.save({ bggUser: 'anna', cookies: `SessionID=${SESSION_ID}` }, GAME, { status: { own: true } })
    expect(times).toEqual([0, 1000])
  })
})
