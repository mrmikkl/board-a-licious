import type { StatusKey } from '../../domain/bgg-status.ts'
import { STATUS_NAMES } from '../../domain/bgg-status.ts'
import { Header } from '../components/Header.tsx'
import { href } from '../router.ts'

/** F008 (docs/design.md "Status list"): one BGG status list; its games follow with US1. */
export function StatusList({ bggUser, status }: { bggUser: string; status: StatusKey }) {
  return (
    <>
      <Header title={STATUS_NAMES[status]} back={href({ name: 'lists', tab: 'status' })} />
      <main className="screen">
        <p className="lead">{bggUser} on BoardGameGeek</p>
      </main>
    </>
  )
}
