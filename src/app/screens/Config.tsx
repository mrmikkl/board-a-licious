import { type FormEvent, type MouseEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import { DEFAULT_BADGE_COLOURS, STATUS_KEYS, STATUS_NAMES, type StatusKey } from '../../domain/bgg-status.ts'
import { Badge, useBgg } from '../components/BggBadges.tsx'
import { ColourSheet, SAMPLE } from '../components/ColourSheet.tsx'
import { Header } from '../components/Header.tsx'
import { SignInSheet } from '../components/SignInSheet.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggAccount } from '../hooks/useBggAccount.ts'
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
        <ShareHint />
        <BggSection />
        <hr className="separator" />
        <BadgeColours />
        <hr className="separator" />
        <SoundSetting />
        <hr className="separator" />
        <h2 className="section-title">Introduction</h2>
        <p className="lead">The three cards from the first start, once more.</p>
        <button type="button" className="btn btn-block" onClick={showIntro}>
          Show the intro again
        </button>
        <hr className="separator" />
        <h2 className="section-title">Share and backup</h2>
        <p className="lead">Send a shopping list to a chat, or save all shopping lists to a file and load them back.</p>
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

/**
 * F002 Share hint (docs/design.md "Share hint", research R6): only in a browser tab, as the share
 * menu offers board-a-licious only once it is on the home screen (opened from there it runs standalone).
 */
function ShareHint() {
  if (window.matchMedia('(display-mode: standalone)').matches) return null
  return (
    <>
      <section className="card hint-card" aria-labelledby="share-hint-title">
        <h2 id="share-hint-title" className="card-title">
          📲 Share from BoardGameGeek
        </h2>
        <p className="card-sub">Once board-a-licious is on your home screen, you can share any game from the BGG app or website straight into a shopping list.</p>
        <p className="card-sub">
          In Chrome: menu ⋮ → <b>Add to Home screen</b>. Afterwards, open board-a-licious from its icon.
        </p>
      </section>
      <hr className="separator" />
    </>
  )
}

/**
 * F008 (docs/design.md "Sign in to BoardGameGeek"): the BoardGameGeek section. The username is synced
 * (FR-001); the sign-in card (US3) below it shows who the BGG cookie of this device signs in as.
 */
function BggSection() {
  const services = useServices()
  const toast = useToast()
  const fieldId = useId()
  const hintId = useId()
  const saved = useStoreData(store => store.bggUsername())
  const [name, setName] = useState<string>()
  // the field starts with the saved name once it is read
  useEffect(() => {
    if (saved !== undefined) setName(current => current ?? saved ?? '')
  }, [saved])
  const value = name ?? ''
  const changed = saved !== undefined && value.trim().toLowerCase() !== (saved ?? '').toLowerCase()
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!changed) return
    const next = value.trim() || null
    await services.store.setBggUsername(next)
    void services.sync.schedule()
    setName(next ?? '')
    toast(next ? `Saved your BGG username: ${next}` : 'Removed your BGG username')
  }
  return (
    <section aria-labelledby="bgg-title">
      <h2 id="bgg-title" className="section-title">
        BoardGameGeek
      </h2>
      <form className="card cfg-card" onSubmit={e => void save(e)}>
        <label className="label" htmlFor={fieldId}>
          Your BGG username
        </label>
        <div className="field">
          <input
            id={fieldId}
            value={value}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. mrmikkl"
            aria-describedby={hintId}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <p className="hint" id={hintId}>
          Shows your status lists in Lists and your statuses as badges on games. Reading needs no password.
        </p>
        <button type="submit" className="btn" disabled={!changed}>
          Save username
        </button>
      </form>
      <BggSignIn />
    </section>
  )
}

/**
 * F008 (US3, docs/design.md "Sign in to BoardGameGeek"): the card "Change statuses on BGG": not signed
 * in, what it allows and Sign in to BoardGameGeek; signed in, who on this device and Sign out.
 */
function BggSignIn() {
  const { signedInAs, signOut } = useBggAccount()
  const toast = useToast()
  const [signingIn, setSigningIn] = useState(false)
  const out = async () => {
    try {
      await signOut()
      toast('Signed out of BoardGameGeek on this device')
    } catch {
      toast('Signing out needs a connection. Try again.')
    }
  }
  return (
    <>
      <h2 className="section-title">Change statuses on BGG</h2>
      <div className="card cfg-card">
        {signedInAs ? (
          <>
            <p className="signed-in">Signed in to BoardGameGeek as {signedInAs} on this device</p>
            <p className="hint">
              Changes you save in a game's BGG status, and “mark as owned” after buying, go to your BGG collection. Only this device; your password is not kept.
            </p>
            <button type="button" className="btn btn-danger" onClick={() => void out()}>
              Sign out of BoardGameGeek
            </button>
          </>
        ) : (
          <>
            <p>Sign in to change statuses and add what you paid on BoardGameGeek.</p>
            <p className="hint">The app uses your password once to sign in and does not keep it. The sign-in stays on this device only; other devices sign in on their own.</p>
            <button type="button" className="btn btn-primary" disabled={signedInAs === undefined} onClick={() => setSigningIn(true)}>
              Sign in to BoardGameGeek
            </button>
          </>
        )}
      </div>
      {signingIn && <SignInSheet onSignedIn={() => setSigningIn(false)} onCancel={() => setSigningIn(false)} />}
    </>
  )
}

/** F008 (docs/design.md "Badge colours"): one row per status opening its colour sheet; Reset colours. */
function BadgeColours() {
  const { store } = useServices()
  const toast = useToast()
  const { colours } = useBgg()
  const [open, setOpen] = useState<StatusKey>()
  const isDefault = STATUS_KEYS.every(key => colours[key] === DEFAULT_BADGE_COLOURS[key])
  const reset = async () => {
    await store.setMeta('badgeColours', DEFAULT_BADGE_COLOURS)
    toast('Badge colours reset')
  }
  return (
    <section aria-labelledby="colours-title">
      <h2 id="colours-title" className="section-title">
        Badge colours
      </h2>
      <p className="lead">How your BGG statuses look on games. Tap one to change its colour.</p>
      <ul className="colour-rows">
        {STATUS_KEYS.map(key => (
          <li key={key}>
            <button type="button" aria-label={`Change the colour of ${STATUS_NAMES[key]}`} onClick={() => setOpen(key)}>
              <Badge statusKey={key} status={SAMPLE} colours={colours} />
              <span className="chg" aria-hidden="true">
                Change
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-block" disabled={isDefault} onClick={() => void reset()}>
        Reset colours
      </button>
      {open && <ColourSheet status={open} onClose={() => setOpen(undefined)} />}
    </section>
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
