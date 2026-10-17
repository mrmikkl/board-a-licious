import { useSyncExternalStore } from 'react'

import { Header } from '../components/Header.tsx'
import { useServices } from '../context.tsx'
import { showIntro } from '../intro.ts'
import { href } from '../router.ts'

/** Config (design.md "Navigation"): sound, the introduction, and the way to sharing and backup. */
export function Config() {
  return (
    <>
      <Header title="Config" />
      <main className="screen config">
        <SoundSetting />
        <hr className="separator" />
        <h2 className="section-title">Introduction</h2>
        <p className="lead">The three cards from the first start, once more.</p>
        <button type="button" className="btn btn-block" onClick={showIntro}>
          Show the intro again
        </button>
        <hr className="separator" />
        <h2 className="section-title">Share and backup</h2>
        <p className="lead">Send a collection to a chat, or save all collections to a file and load them back.</p>
        <a className="btn btn-primary btn-block" href={href({ name: 'share' })}>
          Share and backup
        </a>
      </main>
    </>
  )
}

/** Sound and vibration on marking (FR-026); switched only here. */
function SoundSetting() {
  const { feedback } = useServices()
  const on = useSyncExternalStore(
    listener => feedback.subscribe(listener),
    () => feedback.isOn(),
  )
  return (
    <>
      <h2 className="section-title">Sound</h2>
      <label className="toggle">
        <span className="toggle-text">
          Sound and vibration
          <small>A dice roll when you mark a game, a chime when you buy one.</small>
        </span>
        <input type="checkbox" role="switch" className="switch" checked={on} aria-checked={on} onChange={e => void feedback.setOn(e.target.checked)} />
      </label>
    </>
  )
}
