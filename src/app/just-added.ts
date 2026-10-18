/**
 * F002 "Just added" (docs/design.md v1.9.0 Motion): the game row added last (e.g. from a share)
 * keeps the hover highlight until the user scrolls or taps elsewhere.
 * SKELETON: API is final; worker C (T010) implements it and its use in Collection/GameRow.
 */
export function markJustAdded(_collectionId: string, _bggId: number): void {}

/** The bggId to highlight in this collection, or undefined; re-renders when it is cleared. */
export function useJustAdded(_collectionId: string): number | undefined {
  return undefined
}
