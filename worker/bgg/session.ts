/**
 * F008 (research.md R4): the person's BGG session in an HttpOnly cookie on the app's origin,
 * AES-GCM encrypted under the Worker secret `BGG_SESSION_KEY` and bound to the app person's email.
 * Never log the key, the cookie value or the BGG cookies.
 */

export type BggSession = {
  /** The app person's Access email. */
  email: string
  bggUser: string
  /** BGG's cookies as a `Cookie` header value. */
  cookies: string
  /** ISO time; BGG's session lifetime, at most 30 days. */
  expiresAt: string
}

const NAME = 'bal_bgg'
const ATTRIBUTES = 'Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict'
export const MAX_AGE = 30 * 24 * 3600
const IV_BYTES = 12

function keyBytes(key: string | undefined): Uint8Array {
  let bytes: Uint8Array | null = null
  try {
    if (key) bytes = Uint8Array.from(atob(key), c => c.charCodeAt(0))
  } catch { /* not base64 */ }
  if (bytes?.length !== 32) throw new Error('BGG_SESSION_KEY is missing or not 32 bytes in base64')
  return bytes
}

const importKey = (key: string | undefined) =>
  crypto.subtle.importKey('raw', keyBytes(key) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])

const toBase64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  try {
    return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** IV and ciphertext of the session as JSON, base64url. */
export async function seal(session: BggSession, key: string | undefined): Promise<string> {
  const cryptoKey = await importKey(key)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plain = new TextEncoder().encode(JSON.stringify(session))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plain))
  const out = new Uint8Array(IV_BYTES + sealed.length)
  out.set(iv)
  out.set(sealed, IV_BYTES)
  return toBase64url(out)
}

/** The session, or null when tampered, under another key, for another person or expired. */
export async function open(value: string, key: string | undefined, email: string, now: Date): Promise<BggSession | null> {
  const cryptoKey = await importKey(key)
  const bytes = fromBase64url(value)
  if (!bytes || bytes.length <= IV_BYTES) return null
  let session: BggSession
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) }, cryptoKey, bytes.slice(IV_BYTES))
    session = JSON.parse(new TextDecoder().decode(plain))
  } catch {
    return null
  }
  if (typeof session?.email !== 'string' || session.email.toLowerCase() !== email.toLowerCase()) return null
  if (!(Date.parse(session.expiresAt) > now.getTime())) return null
  return session
}

export const setCookie = (value: string, maxAgeSeconds: number) =>
  `${NAME}=${value}; ${ATTRIBUTES}; Max-Age=${Math.max(0, Math.min(MAX_AGE, Math.floor(maxAgeSeconds)))}`

export const clearCookie = () => `${NAME}=; ${ATTRIBUTES}; Max-Age=0`

export function readCookie(request: Request): string | null {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === NAME) return rest.join('=') || null
  }
  return null
}
