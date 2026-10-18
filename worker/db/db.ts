import postgres from 'postgres'

/** The little the repository needs from PostgreSQL; PGlite implements it in tests. */
export type Db = {
  query<T>(text: string, params?: unknown[]): Promise<T[]>
}

/** PostgreSQL over Hyperdrive (or a direct URL locally). One small pool per request, as Hyperdrive pools for us. */
export function connect(connectionString: string): Db & { close(): Promise<void> } {
  const sql = postgres(connectionString, { max: 5, fetch_types: false, prepare: true })
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[]
    },
    close: () => sql.end({ timeout: 5 }),
  }
}
