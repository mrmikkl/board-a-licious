import { useCallback, useMemo } from 'react'

import { readShare } from '../../domain/shared.ts'
import { NotAGameSheet } from '../components/NotAGameSheet.tsx'
import { SharedGameSheet } from '../components/SharedGameSheet.tsx'
import { useStoreData } from '../context.tsx'
import { type Route, navigate } from '../router.ts'
import { Collection } from './Collection.tsx'
import { Collections } from './Collections.tsx'

/**
 * F002: something shared to the app (contracts/share-target.md). A game opens the "Add game" sheet
 * over the collection shared into last (else the first by name, else the collections screen); a BGG
 * list opens that list; anything else the "Not a BoardGameGeek game" sheet. Leaving replaces the
 * share in the history, so Back does not open it again.
 */
export function Shared({ title, text, url }: { title?: string; text?: string; url?: string }) {
  const result = useMemo(() => readShare({ title, text, url }), [title, text, url])
  const data = useStoreData(async store => {
    const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
    const entries = (await store.allEntries()).filter(e => !e.deleted)
    const last = await store.meta('lastShareCollection')
    return { collections, entries, last }
  })

  const preselected = data && (data.collections.find(c => c.id === data.last) ?? data.collections[0])?.id
  const close = useCallback(() => {
    const background: Route = preselected ? { name: 'collection', id: preselected } : { name: 'collections' }
    navigate(background, { replace: true })
  }, [preselected])
  const addByLink = useCallback(() => {
    close()
    navigate({ name: 'add', what: 'game' })
  }, [close])

  if (result.kind === 'list' || !data) return null
  return (
    <>
      {preselected ? <Collection key={preselected} id={preselected} /> : <Collections />}
      {result.kind === 'game' ? (
        <SharedGameSheet
          bggId={result.bggId}
          suggestedName={result.suggestedName}
          collections={data.collections}
          entries={data.entries}
          preselected={preselected}
          onClose={close}
        />
      ) : (
        <NotAGameSheet shown={result.shown} onClose={close} onAddByLink={addByLink} />
      )}
    </>
  )
}
