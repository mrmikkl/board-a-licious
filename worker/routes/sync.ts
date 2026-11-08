import { type Collection, type Entry, validateCollection, validateEntry } from '../../src/domain/collection.ts'
import { type LoadedList, validateLoadedList } from '../../src/domain/lists.ts'
import type { Db } from '../db/db.ts'
import { type FollowedBggUser, ForeignCollectionError, type UserSetting, applyChanges, listChanges, syncCursor } from '../db/repository.ts'
import { HttpError } from '../http.ts'

const MAX_ITEMS = 500
const MAX_FUTURE_MS = 5 * 60 * 1000
/** F008: BGG usernames: letters, digits, underscore, dot, hyphen and inner spaces, 1–50 characters. */
const BGG_NAME = /^[A-Za-z0-9_.-](?:[A-Za-z0-9_. -]{0,48}[A-Za-z0-9_.-])?$/

const isTime = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))

/** F008: an optional array of the body; anything else than a list is a clear 400. */
function optionalList(body: Record<string, unknown>, key: string): unknown[] {
  const value = body?.[key]
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new HttpError('bad_request', `${key} must be a list.`)
  return value
}

function validateSetting(value: unknown): string | null {
  const s = value as Partial<UserSetting> | null
  if (typeof s !== 'object' || s === null) return 'must be an object.'
  if (s.bggUsername !== null && (typeof s.bggUsername !== 'string' || !BGG_NAME.test(s.bggUsername)))
    return 'bggUsername must be null or a BGG username of 1–50 letters, digits, spaces, _ . or -.'
  if (!isTime(s.updatedAt)) return 'updatedAt must be a timestamp.'
  return null
}

function validateFollow(value: unknown): string | null {
  const f = value as Partial<FollowedBggUser> | null
  if (typeof f !== 'object' || f === null) return 'must be an object.'
  if (typeof f.bggUser !== 'string' || !BGG_NAME.test(f.bggUser)) return 'bggUser must be a BGG user name of 1–50 letters, digits, spaces, _ . or -.'
  if (!isTime(f.updatedAt)) return 'updatedAt must be a timestamp.'
  if (typeof f.deleted !== 'boolean') return 'deleted must be true or false.'
  return null
}

export async function getSync(db: Db, email: string, url: URL): Promise<Response> {
  const since = url.searchParams.get('since') ?? undefined
  if (since !== undefined && Number.isNaN(Date.parse(since))) throw new HttpError('bad_request', 'since must be a timestamp.')
  // the cursor comes from the database's clock (not the Worker's or the device's), taken before
  // reading and a few seconds back, so nothing written meanwhile is skipped by the next pull
  const serverTime = await syncCursor(db)
  return Response.json({ ...(await listChanges(db, email, since)), serverTime })
}

export async function postSync(db: Db, email: string, request: Request, now: Date): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as typeof body
  } catch {
    throw new HttpError('bad_request', 'The body must be JSON.')
  }
  const collections = (Array.isArray(body?.collections) ? body.collections : []) as Collection[]
  const entries = (Array.isArray(body?.entries) ? body.entries : []) as Entry[]
  const lists = (Array.isArray(body?.lists) ? body.lists : []) as LoadedList[]
  // F008: optional, so older app versions that do not send them keep working
  const settings = optionalList(body, 'settings') as UserSetting[]
  const follows = optionalList(body, 'follows') as FollowedBggUser[]
  const count = collections.length + entries.length + lists.length + settings.length + follows.length
  if (count < 1 || count > MAX_ITEMS) throw new HttpError('bad_request', `Send between 1 and ${MAX_ITEMS} items.`)

  const latest = now.getTime() + MAX_FUTURE_MS
  for (const c of collections) {
    const problem = validateCollection(c)
    if (problem) throw new HttpError('bad_request', `Collection ${String(c?.id)}: ${problem}`)
    if (Date.parse(c.updatedAt) > latest) throw new HttpError('bad_request', `Collection ${c.id}: updatedAt is in the future.`)
  }
  for (const e of entries) {
    const problem = validateEntry(e)
    if (problem) throw new HttpError('bad_request', `Entry ${String(e?.bggId)}: ${problem}`)
    if (Date.parse(e.updatedAt) > latest) throw new HttpError('bad_request', `Entry ${e.bggId}: updatedAt is in the future.`)
  }

  for (const l of lists) {
    const problem = validateLoadedList(l)
    if (problem) throw new HttpError('bad_request', `List ${String(l?.kind)}/${String(l?.id)}: ${problem}`)
    if (Date.parse(l.updatedAt) > latest) throw new HttpError('bad_request', `List ${l.kind}/${l.id}: updatedAt is in the future.`)
  }

  for (const setting of settings) {
    const problem = validateSetting(setting)
    if (problem) throw new HttpError('bad_request', `Setting: ${problem}`)
    if (Date.parse(setting.updatedAt) > latest) throw new HttpError('bad_request', 'Setting: updatedAt is in the future.')
  }
  for (const f of follows) {
    const problem = validateFollow(f)
    if (problem) throw new HttpError('bad_request', `Followed BGG user ${String(f?.bggUser)}: ${problem}`)
    if (Date.parse(f.updatedAt) > latest) throw new HttpError('bad_request', `Followed BGG user ${f.bggUser}: updatedAt is in the future.`)
  }

  try {
    const lowerFollows = follows.map(f => ({ bggUser: f.bggUser.toLowerCase(), updatedAt: f.updatedAt, deleted: f.deleted }))
    const clean = settings.map(s => ({ bggUsername: s.bggUsername, updatedAt: s.updatedAt }))
    return Response.json(await applyChanges(db, email, { collections, entries, lists, settings: clean, follows: lowerFollows }))
  } catch (error) {
    if (error instanceof ForeignCollectionError) throw new HttpError('bad_request', error.message)
    throw error
  }
}
