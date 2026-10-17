// Local development database: PGlite (PostgreSQL in WebAssembly) served on the PostgreSQL port, data in
// .pglite/. No install or Docker needed. Migrations are applied on start. Stop with Ctrl+C.
import { readFileSync, readdirSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const port = Number(process.env.PGPORT ?? 5432)
const db = await PGlite.create('./.pglite')
const dir = new URL('../migrations/', import.meta.url)
for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(file, dir), 'utf8'))
}
const server = new PGLiteSocketServer({ db, port, maxConnections: 10 })
await server.start()
console.log(`Local PostgreSQL (PGlite) on postgres://postgres:postgres@localhost:${port}/boardalicious`)

const stop = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
