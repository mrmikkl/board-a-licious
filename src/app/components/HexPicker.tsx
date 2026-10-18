import type { ReactNode } from 'react'

export type HexOption<K extends string> = { key: K; label: string; icon?: ReactNode; tone?: string }

/**
 * 3–4 equal hexagon buttons in one row (docs/design.md §7); the selected one is filled with its
 * gradient (`tone`, a mark key or "hot").
 */
export function HexPicker<K extends string>({ label, options, value, onPick }: { label: string; options: HexOption<K>[]; value?: K; onPick: (key: K) => void }) {
  return (
    <div className="picker" role="group" aria-label={label} style={{ '--count': options.length } as React.CSSProperties}>
      {options.map(option => (
        <button key={option.key} type="button" className="picker-btn hex-btn" data-tone={option.tone ?? 'hot'} aria-pressed={value === option.key} onClick={() => onPick(option.key)}>
          <span className="picker-hex hex">
            <span className="picker-face hex">
              {option.icon}
              <span>{option.label}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
