import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { Header } from '../components/Header.tsx'
import { IconSearch } from '../components/icons.tsx'

/** Search across BGG needs the official API (Release 1.0); until then it says so and its main 🔍 stays disabled (FR-019). */
export function Search() {
  return (
    <>
      <Header title="Search" />
      <main className="screen">
        <div className="card soon-card">
          <h2 className="card-title">Searching all of BoardGameGeek comes soon</h2>
          <p className="card-sub">It needs official access to BoardGameGeek's data, which is on its way. Until then, add a game by pasting its link.</p>
        </div>
        <div className="form">
          <div>
            <label className="label" htmlFor="search-bgg">
              Search BoardGameGeek
            </label>
            <div className="field is-disabled">
              <IconSearch />
              <input id="search-bgg" type="search" placeholder="Game name" disabled />
            </div>
          </div>
        </div>
      </main>
      <ActionBar main={<MainButton icon={<IconSearch />} label="Search (not available yet)" disabled />} />
    </>
  )
}
