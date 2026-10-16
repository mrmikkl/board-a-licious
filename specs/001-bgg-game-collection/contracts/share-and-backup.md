# Share text and backup file formats

## Share text (FR-016)

Plain text, built by `src/domain/share.ts`, passed to `navigator.share({ text })` or copied to the
clipboard. States in display order; only selected, non-empty states; games sorted by name.

```text
🎲 Anna's Spiel 26 list

⭐ Must Have (2)
• Cascadia (2021) – https://boardgamegeek.com/boardgame/295947
• Ark Nova (2021) – https://boardgamegeek.com/boardgame/342942

👀 Interested (1)
• Harmonies (2024) – https://boardgamegeek.com/boardgame/414317

💩 Poop (1)
• Some Game – https://boardgamegeek.com/boardgame/12345
```

- Header uses the part of the email before `@`; year omitted when unknown.
- Full URLs so messaging apps turn them into links.
- Empty selection: share is not offered (spec edge case).

## Backup file (FR-017)

- File name: `board-a-licious-backup-YYYY-MM-DD.json`, media type `application/json`.
- Contains active entries only (no tombstones).

```json
{
  "format": "board-a-licious-backup",
  "version": 1,
  "exportedAt": "2026-10-16T09:30:00.000Z",
  "entries": [
    { "bggId": 295947, "name": "Cascadia", "year": 2021,
      "thumbnailUrl": "https://cf.geekdo-images.com/…",
      "state": "must_have", "updatedAt": "2026-10-16T09:12:03.120Z" }
  ]
}
```

Import rules:

- Reject (collection unchanged) if: not JSON, `format` differs, `version` > 1, or any entry fails
  validation (unknown state, bad `bggId`). The message names the first problem.
- Games not in the collection are added.
- Games already in the collection: the user picks once for all conflicts — **Keep current** or
  **Use backup**. "Use backup" writes the backup's state with a fresh `updatedAt` so it wins sync.
- Imported changes go through the normal outbox, so they sync to the server like manual edits.
