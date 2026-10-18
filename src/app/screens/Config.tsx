import { type MouseEvent, useRef, useState, useSyncExternalStore } from 'react'

import { Header } from '../components/Header.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices } from '../context.tsx'
import { showIntro } from '../intro.ts'
import { href } from '../router.ts'

/** Config (design.md "Navigation"): sound, the introduction, and the way to sharing and backup. */
const DEVELOPER_KEY = 'bal-developer'
const TAPS = 5
const TAP_WINDOW_MS = 4000

function storedDeveloper(): boolean {
  try {
    return localStorage.getItem(DEVELOPER_KEY) === '1'
  } catch {
    return false
  }
}

/** Links for whoever runs the app; hidden until the "Config" heading is tapped five times. */
const DEVELOPER_LINKS = [
  { label: 'GitHub repository', href: 'https://github.com/mrmikkl/board-a-licious' },
  { label: 'Cloudflare Workers & Pages', href: 'https://dash.cloudflare.com/dc60eec090f57f84a34b456ab65207f1/workers-and-pages' },
  {
    label: 'Cloudflare Access (who may sign in)',
    href: 'https://dash.cloudflare.com/dc60eec090f57f84a34b456ab65207f1/one/access-controls/apps/self-hosted/92742820-1edb-4d35-8044-b94a6fee7c0e/edit?tab=basic-info',
  },
  { label: 'Neon database (roles)', href: 'https://console.neon.tech/app/projects/cold-block-88164058/branches/br-old-king-barpscev/roles' },
]

export function Config() {
  const toast = useToast()
  const [developer, setDeveloper] = useState(storedDeveloper)
  const taps = useRef<number[]>([])
  // five taps on the heading within a few seconds switch the developer section on or off
  // (event.detail counts quick clicks in a row where the browser reports it)
  const tapTitle = (event: MouseEvent) => {
    const now = Date.now()
    taps.current = [...taps.current.filter(t => now - t < TAP_WINDOW_MS), now]
    if (taps.current.length < TAPS && event.detail < TAPS) return
    taps.current = []
    const next = !developer
    setDeveloper(next)
    try {
      localStorage.setItem(DEVELOPER_KEY, next ? '1' : '0')
    } catch {
      // private mode: it just lasts until the page is closed
    }
    toast(next ? 'Developer section shown' : 'Developer section hidden')
  }
  return (
    <>
      <Header title="Config" onTitleClick={tapTitle} />
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
        {developer && (
          <section aria-labelledby="developer-title">
            <hr className="separator" />
            <h2 id="developer-title" className="section-title">
              Developer
            </h2>
            <ul className="dev-links">
              {DEVELOPER_LINKS.map(link => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
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
