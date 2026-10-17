import { type Collection, type Entry, validateCollection, validateEntry } from '../../src/domain/collection.ts'
import type { Db } from '../db/db.ts'
import { ForeignCollectionError, applyChanges, listChanges } from '../db/repository.ts'
import { HttpError } from '../http.ts'

const MAX_ITEMS = 500
const MAX_FUTURE_MS = 5 * 60 * 1000

export async function getSync(db: Db, email: string, url: URL, now: Date): Promise<Response> {
  const since = url.searchParams.get('since') ?? undefined
  if (since !== undefined && Number.isNaN(Date.parse(since))) throw new HttpError('bad_request', 'since must be a timestamp.')
  // serverTime is taken before reading, so nothing written meanwhile is skipped by the next pull
  const serverTime = now.toISOString()
  return Response.json({ ...(await listChanges(db, email, since)), serverTime })
}

export async function postSync(db: Db, email: string, request: Request, now: Date): Promise<Response> {
  let body: { collections?: unknown; entries?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    throw new HttpError('bad_request', 'The body must be JSON.')
  }
  const collections = (Array.isArray(body?.collections) ? body.collections : []) as Collection[]
  const entries = (Array.isArray(body?.entries) ? body.entries : []) as Entry[]
  const count = collections.length + entries.length
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

  try {
    return Response.json(await applyChanges(db, email, { collections, entries }))
  } catch (error) {
    if (error instanceof ForeignCollectionError) throw new HttpError('bad_request', error.message)
    throw error
  }
}
