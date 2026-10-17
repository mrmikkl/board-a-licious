import type { BggClient } from './cache.ts'
import type { ListKind, ListPage } from './source.ts'

/** T045: one page of a preview (`api/geekpreviewitems`) or a geeklist. */
export async function getListPage(_client: BggClient, _kind: ListKind, _id: number, _page: number): Promise<ListPage> {
  throw new Error('not implemented yet (T045)')
}

/** T045: publisher names from `api/geekitems?objectid=<id>&objecttype=company`. */
export async function getCompanies(_client: BggClient, _ids: number[]): Promise<{ id: number; name: string }[]> {
  throw new Error('not implemented yet (T045)')
}
