import { useCallback } from 'react'

import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { CollectionCard } from '../components/CollectionCard.tsx'
import { Header } from '../components/Header.tsx'
import { IconPlus } from '../components/icons.tsx'
import { NewCollectionForm } from '../components/NewCollectionForm.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { useStoreData } from '../context.tsx'
import { href, navigate } from '../router.ts'

/** All collections of the signed-in person (FR-002); the main ＋ opens the New collection sheet (`#/collections?new`). */
export function Collections({ create }: { create?: boolean }) {
  const data = useStoreData(async store => {
    const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
    const entries = await store.allEntries()
    return { collections, entries }
  })
  const close = useCallback(() => navigate({ name: 'collections' }, { replace: true }), [])
  return (
    <>
      <Header title="Collections" />
      <main className="screen">
        {data && data.collections.length === 0 && (
          <div className="empty">
            <div className="hex" />
            <h2>No collections yet</h2>
            <p>Tap + below to create your first one, e.g. for SPIEL 2026.</p>
          </div>
        )}
        {data && data.collections.length > 0 && (
          <>
            <p className="lead">Each collection is your own. Games keep booth, price and edition from lists that have them, such as the SPIEL preview.</p>
            <div className="cards">
              {data.collections.map(c => (
                <CollectionCard key={c.id} collection={c} entries={data.entries.filter(e => e.collectionId === c.id)} />
              ))}
            </div>
          </>
        )}
      </main>
      <ActionBar main={<MainButton icon={<IconPlus />} label="Create a collection" href={href({ name: 'collections', create: true })} />} />
      <Sheet open={Boolean(create)} title="New collection" onClose={close}>
        <NewCollectionForm onCreated={c => navigate({ name: 'collection', id: c.id }, { replace: true })} onCancel={close} />
      </Sheet>
    </>
  )
}
