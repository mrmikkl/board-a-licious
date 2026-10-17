import { createApp } from '../../worker/index.ts'
import type { Db } from '../../worker/db/db.ts'

export const ANNA = 'anna@example.com'

/** The Worker app with a fixed signed-in user, a test database and a fixed clock. */
export function testApp(db: Db, options: { email?: string | null; now?: string } = {}) {
  const app = createApp({
    authenticate: async () => (options.email === undefined ? ANNA : options.email),
    db: () => db,
    now: () => new Date(options.now ?? '2026-10-17T12:00:00.000Z'),
  })
  return (path: string, init?: RequestInit) => app.fetch(new Request(`https://app.example${path}`, init), {} as never)
}

export const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
