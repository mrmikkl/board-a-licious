# Share text and backup file formats

Re-planned 2026-10-17.

## Share text (FR-020)

Built by `src/domain/share.ts` for one collection and the chosen groups; passed to
`navigator.share({ text })`, else copied to the clipboard. Groups in mark order; games by name;
empty groups left out; bought games get ✅; Essen collections add booth and price.

```text
🎲 Essen 2026

⭐ Must Have (2)
• ✅ Example Game – 3-R400, €60 – https://boardgamegeek.com/boardgame/446453
• Another Game – 1-A202, €45 – https://boardgamegeek.com/boardgame/123456

👀 Interested (1)
• Harmonies – https://boardgamegeek.com/boardgame/414317
```

- Full URLs so chat apps link them; "Not yet marked" uses ⬡.
- Nothing selected or all selected groups empty: sharing is not offered and the UI says why.

## Backup file (FR-021)

- Name `board-a-licious-backup-YYYY-MM-DD.json`, type `application/json`, active rows only.

```json
{
  "format": "board-a-licious-backup",
  "version": 2,
  "exportedAt": "2026-10-17T09:30:00.000Z",
  "collections": [
    { "id": "c0f…", "name": "Essen 2026", "type": "essen", "updatedAt": "…",
      "entries": [
        { "bggId": 446453, "name": "…", "year": 2026, "mark": "must_have",
          "bought": true, "paidCents": 5200, "paidCurrency": "EUR",
          "facts": { "booth": "3-R400", "priceCents": 6000, "currency": "EUR", "publisher": "…" },
          "factsSource": "preview", "updatedAt": "…" } ] } ]
}
```

Import rules:

- Reject the whole file (nothing changes) if it is not JSON, `format` differs, `version` is newer
  than 2, or any row fails validation; the message names the first problem.
- Version 1 files (single collection, before the design session) are imported as one standard
  collection named "Imported".
- Collections not present are added; for present ones, missing entries are added and conflicts are
  resolved once for all: **Keep current** or **Use backup** (backup rows get a fresh `updatedAt`).
- Imported rows go through the normal outbox and sync like manual edits.
