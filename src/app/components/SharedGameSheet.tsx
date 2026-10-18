import type { Collection, Entry } from '../../domain/collection.ts'

/**
 * F002 "Shared game" sheet (docs/design.md v1.9.0, specs/002-share-from-bgg/design.md).
 * SKELETON: props are final; worker A (T011, T012, T016) fills in the body.
 * On add it calls addGameByLink, stores meta lastShareCollection, marks the row with
 * markJustAdded (../just-added.ts), shows the toast and navigates (replace) to the collection.
 */
export type SharedGameSheetProps = {
  bggId: number
  suggestedName: string
  /** live collections of the person, sorted by name; empty → the "Create and add" variant */
  collections: Collection[]
  /** live entries of all collections (for "(already in it)") */
  entries: Entry[]
  /** collection to preselect (lastShareCollection if it still exists, else the first) */
  preselected?: string
  /** Cancel / scrim / Esc: nothing added */
  onClose: () => void
}

export function SharedGameSheet(_props: SharedGameSheetProps) {
  return null
}
