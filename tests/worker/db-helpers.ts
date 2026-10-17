import { readFileSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'

import type { Db } from '../../worker/db/db.ts'

/** A fresh in-memory PostgreSQL with the app's migrations applied. */
export async function testDb(): Promise<Db> {
  const pg = new PGlite()
  await pg.exec(readFileSync(new URL('../../migrations/0001_collections.sql', import.meta.url), 'utf8'))
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows
    },
  }
}
