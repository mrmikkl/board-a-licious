// Applies migrations/*.sql in order to DATABASE_URL (local PostgreSQL or Neon). Statements are idempotent.
import { readFileSync, readdirSync } from 'node:fs'

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL to the database to migrate.')
  process.exit(1)
}
const sql = postgres(url, { max: 1 })
const dir = new URL('../migrations/', import.meta.url)
for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await sql.unsafe(readFileSync(new URL(file, dir), 'utf8'))
  console.log(`applied ${file}`)
}
await sql.end()
