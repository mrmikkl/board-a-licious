import type { BggSource } from '../bgg/source.ts'
import type { Db } from '../db/db.ts'

/** What every route gets from the router. */
export type RouteContext = {
  request: Request
  url: URL
  email: string
  db: () => Db
  bgg: BggSource
  now: Date
}
