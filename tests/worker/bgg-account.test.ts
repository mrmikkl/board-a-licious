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

// ---------------------------------------------------------------------------------------------
// Private info and price conflict (US5, research R3)

const OWNED = itemWith('own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0"')
const isEditRead = (c: Call) => c.method === 'GET' && c.url.pathname === '/geekcollection.php'
const ownershipWrite = (calls: Call[]) => calls.find(c => isWrite(c) && fieldOf(c) === 'ownership')

/** The recorded private info form (EUR 45) with other values: price, and every field BGG must keep. */
function editdata(over: { price?: string; currency?: string; keep?: boolean } = {}) {
  let html = web('ownership-editdata.html')
  if (over.price !== undefined) html = html.replace("name='pricepaid' id='pricepaid' value='45'", `name='pricepaid' id='pricepaid' value='${over.price}'`)
  if (over.currency !== undefined) {
    html = html.replace('<option SELECTED value=\'EUR\'>', "<option  value='EUR'>")
    if (over.currency) html = html.replace(`<option  value='${over.currency}'>`, `<option SELECTED value='${over.currency}'>`)
  }
  if (over.keep) {
    html = html
      .replace("<option  value='USD'>USD $</option>\n\t\t\t\t\t\t<option  value='EUR'>EUR &euro;</option>\n\t\t\t\t\t\t<option  value='GBP'>", "<option SELECTED value='USD'>USD $</option>\n\t\t\t\t\t\t<option  value='EUR'>EUR &euro;</option>\n\t\t\t\t\t\t<option  value='GBP'>")
      .replace("name='currvalue' id='currvalue' value=''", "name='currvalue' id='currvalue' value='50'")
      .replace("id='quantity123456789' value=''", "id='quantity123456789' value='2'")
      .replace("<textarea style='width:100%' name='privatecomment' id='privatecomment221'></textarea>", "<textarea style='width:100%' name='privatecomment' id='privatecomment221'>Signed by the author &amp; &quot;co&quot;\nline 2</textarea>")
      .replace("name='invdate' id='invdate221' value=''", "name='invdate' id='invdate221' value='2026-01-02'")
      .replace("id='invdateinput221' value=''", "id='invdateinput221' value='2026-01-02'")
      .replace("name='invlocation' value=''", "name='invlocation' value='Shelf &#39;3&#39;'")
      .replace("name='acquiredfrom' value=''", "name='acquiredfrom' value='Old shop'")
  }
  return html
}

const PRICE = { amount: 45, currency: 'EUR' }
const BOOTH = 'SPIEL Essen 2026 · booth 3-A101'

describe('POST /api/bgg/account/collection/<bggId>: private info (US5, research R3)', () => {
  it('reads the private info form, then sends every field back with price, currency and date as recorded', async () => {
    const { bgg, calls } = site({ items: OWNED })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE, acquisitionDate: '2026-11-08' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ bggId: GAME, status: { ...NONE, own: true } })

    // read the item, read the form, write the form: no status write (nothing changed)
    expect(calls.map(c => (isRead(c) ? 'read' : isEditRead(c) ? 'form' : fieldOf(c)))).toEqual(['read', 'form', 'ownership'])
    const form = calls.find(isEditRead)!
    const recorded = new URL(web('ownership-editdata.url').trim())
    expect(form.url.origin + form.url.pathname).toBe(recorded.origin + recorded.pathname)
    for (const key of ['collid', 'fieldname', 'objecttype', 'objectid', 'ajax', 'action']) expect(form.url.searchParams.get(key)).toBe(recorded.searchParams.get(key))
    expect(form.headers.get('Cookie')).toBe(`SessionID=${SESSION_ID}; bggusername=anna`)
    expect(form.headers.get('Authorization')).toBeNull()

    const write = ownershipWrite(calls)!
    expect(write.headers.get('Cookie')).toBe(`SessionID=${SESSION_ID}; bggusername=anna`)
    expect(write.headers.get('Authorization')).toBeNull()
    expect(pairs(write.body)).toEqual(pairs(web('save-ownership.form')))
  })

  it('keeps every other field BGG holds (current value, quantity, comment, inventory) and sets acquired from', async () => {
    const { bgg, calls } = site({ items: OWNED, editdata: editdata({ price: '', currency: '', keep: true }) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE, acquisitionDate: '2026-11-08', acquiredFrom: BOOTH } }))
    expect(res.status).toBe(200)
    expect(pairs(ownershipWrite(calls)!.body)).toEqual([
      ['fieldname', 'ownership'], ['collid', COLLID], ['objecttype', 'thing'], ['objectid', String(GAME)],
      ['pricepaid', '45'], ['currvalue', '50'], ['quantity', '2'], ['acquisitiondate', '2026-11-08'], ['dateinput', '2026-11-08'],
      ['acquiredfrom', BOOTH], ['invdate', '2026-01-02'], ['dateinput', '2026-01-02'], ['invlocation', "Shelf '3'"], ['B1', 'Cancel'],
      ['pp_currency', 'EUR'], ['cv_currency', 'USD'], ['privatecomment', 'Signed by the author & "co"\nline 2'], ['ajax', '1'], ['action', 'savedata'],
    ])
  })

  it('without a price or date in the request keeps BGG\'s price and date', async () => {
    const { bgg, calls } = site({ items: OWNED, editdata: editdata({ price: '39.99' }) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { acquiredFrom: 'Spiel booth' } }))
    expect(res.status).toBe(200)
    const form = new URLSearchParams(ownershipWrite(calls)!.body)
    expect(form.get('pricepaid')).toBe('39.99')
    expect(form.get('pp_currency')).toBe('EUR')
    expect(form.get('acquiredfrom')).toBe('Spiel booth')
  })

  it('the same price BGG holds (also written as 45.00) is no conflict', async () => {
    const { bgg, calls } = site({ items: OWNED, editdata: editdata({ price: '45.00' }) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(200)
    expect(ownershipWrite(calls)).toBeDefined()
  })

  it.each([
    ['another amount', { price: '39.99' }, { amount: 39.99, currency: 'EUR' }],
    ['another currency', { currency: 'USD' }, { amount: 45, currency: 'USD' }],
  ])('BGG holding %s without replacePrice: 409 price_conflict with the current price, nothing written', async (_, over, current) => {
    const { bgg, calls } = site({ items: OWNED, editdata: editdata(over) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { wishlist: 2 }, privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'price_conflict', retryable: false, current })
    expect(calls.filter(isWrite)).toHaveLength(0)
  })

  it('replacePrice false: writes the status but keeps BGG\'s private info', async () => {
    const { bgg, calls } = site({ items: itemWith('own="0" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0"'), editdata: editdata({ price: '39.99' }) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true }, privateInfo: { pricePaid: PRICE, acquisitionDate: '2026-11-08' }, replacePrice: false }))
    expect(res.status).toBe(200)
    expect((await res.json()).status.own).toBe(true)
    expect(calls.filter(isWrite).map(fieldOf)).toEqual(['status'])
  })

  it('replacePrice true: replaces BGG\'s price', async () => {
    const { bgg, calls } = site({ items: OWNED, editdata: editdata({ price: '39.99' }) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE, acquisitionDate: '2026-11-08' }, replacePrice: true }))
    expect(res.status).toBe(200)
    expect(pairs(ownershipWrite(calls)!.body)).toEqual(pairs(web('save-ownership.form')))
  })

  it('marks a game not in the collection as owned: status save with empty collid, collid read back, then the private info', async () => {
    const { bgg, calls } = site({ items: web('collection-item-none.xml'), after: web('collection-item.xml') })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ status: { own: true }, privateInfo: { pricePaid: PRICE, acquisitionDate: '2026-11-08' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toEqual({ ...NONE, own: true })
    expect(calls.map(c => (isRead(c) ? 'read' : isEditRead(c) ? 'form' : fieldOf(c)))).toEqual(['read', 'read', 'status', 'read', 'ownership'])
    expect(pairs(calls.find(c => isWrite(c) && fieldOf(c) === 'status')!.body)).toEqual(pairs(web('save-status-new.form')))
    // a new item has no private info yet: every other field empty
    expect(pairs(ownershipWrite(calls)!.body)).toEqual(pairs(web('save-ownership.form')))
  })

  it('answers 502 bgg_refused when BGG\'s answer does not show the price sent', async () => {
    const { bgg } = site({ items: OWNED, ownership: () => new Response("<table class='collectiontable_ownership'></table>") })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('bgg_refused')
  })

  it('accepts the recorded answer for a price alone', async () => {
    const { bgg } = site({ items: OWNED, ownership: () => new Response(web('save-ownership-price.html')) })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(200)
  })

  it('answers 502 bgg_refused when the private info form is missing from BGG\'s answer', async () => {
    const { bgg, calls } = site({ items: OWNED, editdata: '<div>Something else</div>' })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(502)
    expect(calls.filter(isWrite)).toHaveLength(0)
  })

  it('answers 401 and clears the cookie when reading the form meets an expired session', async () => {
    const { bgg } = fakeBgg(call =>
      isRead(call) ? new Response(OWNED) : new Response(null, { status: 302, headers: { Location: '/login?redirect_server=1' } }),
    )
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE } }))
    expect(res.status).toBe(401)
    expect(cookieOf(res)).toMatch(/^bal_bgg=; .*Max-Age=0$/)
  })

  it.each([
    ['price 0', { pricePaid: { amount: 0, currency: 'EUR' } }],
    ['a negative price', { pricePaid: { amount: -1, currency: 'EUR' } }],
    ['a price over 10000', { pricePaid: { amount: 10000.01, currency: 'EUR' } }],
    ['a price as text', { pricePaid: { amount: '45', currency: 'EUR' } }],
    ['a currency BGG does not offer', { pricePaid: { amount: 45, currency: 'CHF' } }],
    ['no currency', { pricePaid: { amount: 45 } }],
    ['a date not YYYY-MM-DD', { acquisitionDate: '08.11.2026' }],
    ['an impossible date', { acquisitionDate: '2026-13-01' }],
    ['acquiredFrom over 100 characters', { acquiredFrom: 'x'.repeat(101) }],
    ['an unknown key', { comment: 'hi' }],
    ['no field at all', {}],
  ])('answers 400 for %s without asking BGG', async (_, privateInfo) => {
    const { bgg, calls } = site({ items: OWNED })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo }))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('answers 400 for a replacePrice that is not true or false', async () => {
    const { bgg, calls } = site({ items: OWNED })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { pricePaid: PRICE }, replacePrice: 'yes' }))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('accepts acquiredFrom of exactly 100 characters', async () => {
    const { bgg } = site({ items: OWNED })
    const res = await testApp(db, { bgg, env: ENV, now: NOW })(path, await save({ privateInfo: { acquiredFrom: 'x'.repeat(100) } }))
    expect(res.status).toBe(200)
  })
})
