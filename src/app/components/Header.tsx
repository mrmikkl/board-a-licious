import { type ReactNode, useSyncExternalStore } from 'react'

import { useOptionalServices } from '../context.tsx'
import { SoundToggle } from './SoundToggle.tsx'

/** Whether sound is on; follows the header button and the Config switch alike. */
export function useSoundOn(): boolean {
  const services = useOptionalServices()
  return useSyncExternalStore(
    listener => services?.feedback.subscribe(listener) ?? (() => undefined),
    () => services?.feedback.isOn() ?? true,
  )
}

/** The 🔊/🔇 toggle; every screen header has it once the app is signed in (design.md "Navigation"). */
function HeaderSound() {
  const services = useOptionalServices()
  const on = useSoundOn()
  if (!services) return null
  return <SoundToggle on={on} onChange={value => void services.feedback.setOn(value)} />
}

/** Screen header: back button (or logo), title, and the sound toggle slot on the right. */
export function Header({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="top">
      <div className="top-main">
      {back ? (
        <a className="icon-btn back" href={back} aria-label="Back">
          ‹
        </a>
      ) : (
        <span className="logo hex" aria-hidden="true">
          B
        </span>
      )}
      <h1>{title}</h1>
      </div>
      {/* phones: a second row for badges, menus and sound, so long titles keep their room */}
      <div className="top-tools">
        {actions}
        <HeaderSound />
      </div>
    </header>
  )
}
