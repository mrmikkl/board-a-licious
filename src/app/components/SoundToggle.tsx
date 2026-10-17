/** Header button that mutes sound and vibration (design §10); the caller stores the choice. */
export function SoundToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={on}
      aria-label={on ? 'Sound on' : 'Sound off'}
      onClick={() => onChange(!on)}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
    </button>
  )
}
