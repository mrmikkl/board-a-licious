import type { ReactNode } from 'react'

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
    </header>
  )
}
