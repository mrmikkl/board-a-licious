import { type FormEvent, useState } from 'react'

import { type LinkState, GameLinkFields, emptyLink } from '../components/GameLinkFields.tsx'
import { Header } from '../components/Header.tsx'
import { useToast } from '../components/Toast.tsx'
import { addGameByLink } from '../actions.ts'
import { useServices, useStoreData } from '../context.tsx'
import { href, navigate } from '../router.ts'

/** Add a game by its link inside a collection: no collection choice, back to the collection (FR-016). */
export function AddByLink({ id }: { id: string }) {
  const services = useServices()
  const toast = useToast()
  const [link, setLink] = useState<LinkState>(emptyLink)
  const [busy, setBusy] = useState(false)
  const data = useStoreData(
    async store => ({
      id,
      collection: (await store.collections()).find(c => c.id === id && !c.deleted),
      inside: new Set((await store.entries(id)).filter(e => !e.deleted).map(e => e.bggId)),
    }),
    [id],
  )
  const back = href({ name: 'collection', id })
  const collection = data?.id === id ? data.collection : undefined
  const parsed = link.parsed?.ok ? link.parsed : null
  const already = parsed && data?.inside.has(parsed.bggId)
  const ready = Boolean(collection && parsed && link.name.trim() && !already && !busy)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !collection || !parsed) return
    setBusy(true)
    try {
      await addGameByLink(services, collection.id, parsed.bggId, link.name)
      toast(`Added ${link.name.trim()} to ${collection.name}`)
      navigate({ name: 'collection', id: collection.id })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header title="Add by link" back={back} />
      <main className="screen">
        {data?.id === id && !collection ? (
          <p className="lead">
            This collection does not exist anymore. <a href={href({ name: 'collections' })}>Go to your collections</a>
          </p>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="lead">Paste the link of a game on boardgamegeek.com.</p>
            <GameLinkFields state={link} onChange={setLink} />
            {already && <p className="hint error">This game is already in {collection?.name}.</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={!ready}>
              Add to {collection?.name ?? 'collection'}
            </button>
          </form>
        )}
      </main>
    </>
  )
}
