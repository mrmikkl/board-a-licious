import { readFileSync, readdirSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'

import type { Db } from '../../worker/db/db.ts'

/** A fresh in-memory PostgreSQL with the app's migrations applied. */
export async function testDb(): Promise<Db> {
  const pg = new PGlite()
  const dir = new URL('../../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await pg.exec(readFileSync(new URL(file, dir), 'utf8'))
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows
    },
  }
}
