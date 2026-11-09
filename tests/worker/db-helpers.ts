import { readFileSync, readdirSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'

import type { Db } from '../../worker/db/db.ts'

const dir = new URL('../../migrations/', import.meta.url)
/** The SQL of one file in migrations/, by its name. */
export const migrationSql = (file: string) => readFileSync(new URL(file, dir), 'utf8')

/**
 * A fresh in-memory PostgreSQL with the app's migrations applied; with `before`, only the files whose
 * names sort before it (to test what a later file does to older rows). `exec` runs a whole SQL file.
 */
export async function testDb(options: { before?: string } = {}): Promise<Db & { exec(sql: string): Promise<void> }> {
  const pg = new PGlite()
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql') && (options.before === undefined || f < options.before))
    .sort()
  for (const file of files) await pg.exec(migrationSql(file))
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows
    },
    async exec(sql: string) {
      await pg.exec(sql)
    },
  }
}
