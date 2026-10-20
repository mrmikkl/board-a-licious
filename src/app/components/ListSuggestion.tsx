import { SPIEL_PREVIEW_LINK } from '../../domain/lists.ts'

/** Above a BGG list link field: one tap fills in the SPIEL Essen 2026 preview (docs/design.md "Load a BGG list"). */
export function ListSuggestion({ onPick }: { onPick: (link: string) => void }) {
  return (
    <button type="button" className="chip list-suggestion" onClick={() => onPick(SPIEL_PREVIEW_LINK)}>
      <span aria-hidden="true">✨</span> Try the SPIEL Essen 2026 preview
    </button>
  )
}
