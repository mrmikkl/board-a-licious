import { type ChangeEvent, useCallback, useId, useRef, useState } from 'react'

import type { Backup, Resolution } from '../../domain/backup.ts'
import type { Mark } from '../../domain/marks.ts'
import { DEFAULT_SHARE_MARKS, shareGroups, shareText } from '../../domain/share.ts'
import { Header } from '../components/Header.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { href } from '../router.ts'
import { applyImport, backupFile, checkImport, shareList } from '../share-actions.ts'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

type Question = { backup: Backup; games: number; collections: number }

/** Share one collection as text and back up all of them (FR-020, FR-021). */
export function Share() {
  const services = useServices()
  const toast = useToast()
  const selectId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<string>()
  const [marks, setMarks] = useState<Set<Mark>>(() => new Set(DEFAULT_SHARE_MARKS))
  const [importError, setImportError] = useState<string>()
  const [question, setQuestion] = useState<Question>()
  const closeQuestion = useCallback(() => setQuestion(undefined), [])

  const data = useStoreData(async store => {
    const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
    const entries = (await store.allEntries()).filter(e => !e.deleted)
    const games = new Map((await store.games([...new Set(entries.map(e => e.bggId))])).map(g => [g.bggId, g]))
    return { collections, entries, games }
  })

  const collection = data?.collections.find(c => c.id === chosen) ?? data?.collections[0]
  const message = collection && data ? shareText(collection, data.entries, marks, data.games) : undefined

  const toggle = (mark: Mark, on: boolean) =>
    setMarks(current => {
      const next = new Set(current)
      if (on) next.add(mark)
      else next.delete(mark)
      return next
    })

  const share = async () => {
    if (!message?.ok) return
    const outcome = await shareList(message.text)
    if (outcome === 'copied') toast('Copied. Paste it into your chat.')
    if (outcome === 'failed') toast('Select the preview text to copy it.')
  }

  const exportBackup = async () => {
    const file = await backupFile(services)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }))
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 0)
    toast('Backup exported')
  }

  const save = async (backup: Backup, resolution: Resolution) => {
    setQuestion(undefined)
    const added = await applyImport(services, backup, resolution)
    toast(
      added.collections + added.games === 0
        ? 'Nothing to import: everything in the backup is already here.'
        : `Imported ${plural(added.collections, 'collection', 'collections')} and ${plural(added.games, 'game', 'games')}`,
    )
  }

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(undefined)
    const checked = await checkImport(services, await file.text())
    if (!checked.ok) return setImportError(`${checked.error} Nothing was changed.`)
    if (checked.games + checked.collections === 0) return save(checked.backup, 'keep')
    setQuestion(checked)
  }

  if (!data) return <Header title="Share & backup" />
  const groups = collection ? shareGroups(collection.id, data.entries) : []

  return (
    <>
      <Header title="Share & backup" />
      <main className="screen share">
        <h2 className="section-title">Share a list</h2>
        {collection ? (
          <>
            <label className="label" htmlFor={selectId}>
              Collection
            </label>
            <div className="field select">
              <select id={selectId} value={collection.id} onChange={e => setChosen(e.target.value)}>
                {data.collections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="share-groups">
              <legend className="label">Groups to include</legend>
              {groups.map(g => (
                <label key={g.mark} className="check">
                  <input type="checkbox" checked={marks.has(g.mark)} onChange={e => toggle(g.mark, e.target.checked)} />
                  <span>
                    {g.emoji} {g.label}
                  </span>
                  <small>{plural(g.count, 'game', 'games')}</small>
                </label>
              ))}
            </fieldset>
            {message?.ok ? (
              <>
                <div className="share-preview" role="region" aria-label="Message preview" tabIndex={0}>
                  {message.text}
                </div>
                <button type="button" className="btn btn-primary btn-block" onClick={() => void share()}>
                  Share list
                </button>
              </>
            ) : (
              message && <p className="hint error">{message.reason}</p>
            )}
          </>
        ) : (
          <>
            <p className="lead">No collections to share yet. Create one, or import a backup below.</p>
            <a className="btn btn-primary btn-block" href={href({ name: 'add', what: 'collection' })}>
              Create a collection
            </a>
          </>
        )}

        <hr className="separator" />
        <h2 className="section-title">Backup</h2>
        <p className="lead">Your collections are saved to your account. A backup file is your own extra copy of all of them.</p>
        <div className="share-split">
          <button type="button" className="btn" onClick={() => void exportBackup()} disabled={!collection}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={e => void pickFile(e)} />
        {importError && (
          <p className="hint error" role="alert">
            {importError}
          </p>
        )}
      </main>
      {question && <ImportQuestion question={question} onAnswer={resolution => void save(question.backup, resolution)} onClose={closeQuestion} />}
    </>
  )
}

/** Asked once per import: keep this device's version of everything that differs, or take the backup's. */
function ImportQuestion({ question, onAnswer, onClose }: { question: Question; onAnswer: (r: Resolution) => void; onClose: () => void }) {
  const parts = [
    question.games > 0 && plural(question.games, 'game', 'games'),
    question.collections > 0 && plural(question.collections, 'collection name', 'collection names'),
  ].filter(Boolean)
  const verb = question.games + question.collections === 1 ? 'differs' : 'differ'
  return (
    <Sheet open title={`${parts.join(' and ')} ${verb} from the backup`} onClose={onClose}>
      <p className="lead">Missing collections and games are added either way. Which version do you want for the ones that differ?</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => onAnswer('keep')}>
          Keep current
        </button>
        <button type="button" className="btn btn-block" onClick={() => onAnswer('backup')}>
          Use backup
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
