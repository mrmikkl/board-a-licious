import { type ReactNode, useEffect, useState } from 'react'

import { useOptionalServices } from '../context.tsx'
import { SoundToggle } from './SoundToggle.tsx'

/** The 🔊/🔇 toggle; every screen header has it once the app is signed in (design.md "Navigation"). */
function HeaderSound() {
  const services = useOptionalServices()
  const [on, setOn] = useState(true)
  useEffect(() => {
    if (!services) return
    void services.feedback.ready.then(() => setOn(services.feedback.isOn()))
  }, [services])
  if (!services) return null
  return (
    <SoundToggle
      on={on}
      onChange={value => {
        setOn(value)
        void services.feedback.setOn(value)
      }}
    />
  )
}

/** Screen header: back button (or logo), title, and the sound toggle slot on the right. */
export function Header({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="top">
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
      {actions}
      <HeaderSound />
    </header>
  )
}
