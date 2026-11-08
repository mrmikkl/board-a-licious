import { describe, expect, it } from 'vitest'

import { type BggSession, clearCookie, open, readCookie, seal, setCookie } from '../../worker/bgg/session.ts'

const keyOf = (fill: number) => Buffer.from(new Uint8Array(32).fill(fill)).toString('base64')
const KEY = keyOf(7)
const OTHER_KEY = keyOf(9)
const NOW = new Date('2026-10-20T10:00:00.000Z')
const session: BggSession = {
  email: 'Anna@Example.com',
  bggUser: 'anna',
  cookies: 'bggusername=anna; bggpassword=secret; SessionID=abc',
  expiresAt: '2026-11-01T00:00:00.000Z',
}

describe('BGG session cookie: sealing (R4)', () => {
  it('opens what it sealed for the same person before it expires', async () => {
    const value = await seal(session, KEY)
    expect(await open(value, KEY, 'anna@example.com', NOW)).toEqual(session)
  })

  it('gives base64url without the plain cookies and a new value per seal (random IV)', async () => {
    const a = await seal(session, KEY)
    const b = await seal(session, KEY)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
    expect(a).not.toContain('secret')
    expect(Buffer.from(a, 'base64url').toString('latin1')).not.toContain('secret')
  })

  it('rejects a tampered value', async () => {
    const value = await seal(session, KEY)
    const bytes = Buffer.from(value, 'base64url')
    bytes[bytes.length - 1]! ^= 1
    expect(await open(bytes.toString('base64url'), KEY, session.email, NOW)).toBeNull()
    expect(await open('not-a-sealed-value', KEY, session.email, NOW)).toBeNull()
    expect(await open('', KEY, session.email, NOW)).toBeNull()
  })

  it('rejects a value sealed under another key', async () => {
    const value = await seal(session, OTHER_KEY)
    expect(await open(value, KEY, session.email, NOW)).toBeNull()
  })

  it('rejects another person (emails compared case-insensitively)', async () => {
    const value = await seal(session, KEY)
    expect(await open(value, KEY, 'ben@example.com', NOW)).toBeNull()
    expect(await open(value, KEY, 'ANNA@EXAMPLE.COM', NOW)).toEqual(session)
  })

  it('rejects an expired session', async () => {
    const value = await seal(session, KEY)
    expect(await open(value, KEY, session.email, new Date(session.expiresAt))).toBeNull()
    expect(await open(value, KEY, session.email, new Date('2026-12-01T00:00:00.000Z'))).toBeNull()
  })

  it('throws a clear error for a missing or malformed key, without the key in it', async () => {
    const bad = 'c2hvcnQ=' // "short": 5 bytes
    await expect(seal(session, undefined)).rejects.toThrow(/BGG_SESSION_KEY/)
    await expect(seal(session, '')).rejects.toThrow(/BGG_SESSION_KEY/)
    await expect(seal(session, bad)).rejects.toThrow(/BGG_SESSION_KEY/)
    await expect(seal(session, '%%%not base64%%%')).rejects.toThrow(/BGG_SESSION_KEY/)
    await expect(open('x', bad, session.email, NOW)).rejects.toThrow(/BGG_SESSION_KEY/)
    await seal(session, bad).catch((error: Error) => expect(error.message).not.toContain(bad))
  })
})

describe('BGG session cookie: headers (R4)', () => {
  it('sets bal_bgg on the account path, HttpOnly, Secure, SameSite=Strict', () => {
    expect(setCookie('abc_-1', 3600)).toBe('bal_bgg=abc_-1; Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict; Max-Age=3600')
  })

  it('caps Max-Age at 30 days and never goes below 0', () => {
    expect(setCookie('v', 90 * 24 * 3600)).toMatch(/; Max-Age=2592000$/)
    expect(setCookie('v', 12.7)).toMatch(/; Max-Age=12$/)
    expect(setCookie('v', -5)).toMatch(/; Max-Age=0$/)
  })

  it('clears it with the same attributes and Max-Age=0', () => {
    expect(clearCookie()).toBe('bal_bgg=; Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict; Max-Age=0')
  })

  it('reads bal_bgg from the Cookie header', () => {
    const request = (cookie?: string) => new Request('https://app.example/api/bgg/account', cookie ? { headers: { Cookie: cookie } } : {})
    expect(readCookie(request('bal_bgg=abc_-1'))).toBe('abc_-1')
    expect(readCookie(request('theme=dark; bal_bgg=abc_-1; other=1'))).toBe('abc_-1')
    expect(readCookie(request('xbal_bgg=nope; bal_bggx=nope'))).toBeNull()
    expect(readCookie(request('bal_bgg='))).toBeNull()
    expect(readCookie(request())).toBeNull()
  })
})
