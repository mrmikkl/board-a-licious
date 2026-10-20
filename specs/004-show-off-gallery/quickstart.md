# Quickstart: Big Game Images, BGG Gallery and Show-off

## Local development

As feature 001: `npm run db:local`, `npm run dev`, http://localhost:5173 at 360×740. The gallery
comes from BGG through the dev Worker; tests use the fixture `tests/fixtures/bgg/images-295947.json`.

## Tests

```bash
npx vitest run tests/unit/gallery.test.ts tests/unit/viewer-gesture.test.ts tests/unit/collection-view.test.ts tests/unit/router.test.ts
npx vitest run --project worker        # GET /api/bgg/images with the fixture
npx playwright test tests/e2e/viewer.spec.ts tests/e2e/show-off.spec.ts
npm test && npm run test:e2e
```

## Deploy

`npm run deploy` (no migration).

## Validation scenarios (phone, deployed)

| # | Scenario | Expected |
|---|---|---|
| 1 | Collection → a game → tap the cover | full-screen image, name, "1 / n" (US1, SC-001) |
| 2 | Swipe left twice, then right past the first image | "3 / n"; at the first image it springs back (FR-002) |
| 3 | Swipe through quickly | no flash of the screen behind (FR-002a) |
| 4 | Swipe down; open again, tap ✕; open again, press Back | each closes, details sheet still there (FR-003) |
| 5 | Same game again | gallery at once, no loading (SC-005) |
| 6 | Airplane mode → another game's cover | cover big, "more images once you are back online" (FR-005) |
| 7 | BGG list → a game → tap the cover | the same viewer (US1 #6) |
| 8 | Collection → Show-off → Must Have + Interested → Show off | honeycomb, three per row, shifted rows, ✓ on bought (US2) |
| 9 | Tap a hexagon; close; Back | viewer; honeycomb; collection |
| 10 | Show-off again | last choice preselected (FR-009) |
| 11 | Collection with 100+ games → Show-off all | smooth scrolling (SC-004) |
