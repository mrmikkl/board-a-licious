import { CollectionCard } from '../components/CollectionCard.tsx'
import { Header } from '../components/Header.tsx'
import { useStoreData } from '../context.tsx'
import { href } from '../router.ts'

/** All collections of the signed-in person (FR-002) and the "Create a collection" card. */
export function Collections() {
  const data = useStoreData(async store => {
    const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
    const entries = await store.allEntries()
    return { collections, entries }
  })
  return (
    <>
      <Header title="Collections" />
      <main className="screen">
        <p className="lead">Each collection is your own. Games keep booth, price and edition from lists that have them, such as the SPIEL preview.</p>
        {data && (
          <div className="cards">
            {data.collections.map(c => (
              <CollectionCard key={c.id} collection={c} entries={data.entries.filter(e => e.collectionId === c.id)} />
            ))}
            <a className="card new-card" href={href({ name: 'add', what: 'collection' })}>
              <span className="hex" aria-hidden="true" />
              Create a collection
            </a>
          </div>
        )}
      </main>
    </>
  )
}
