-- 0006: BGG's player poll summary (feature 006): "Best with 2–3 players", "Recommended with 1–4 players",
-- from the official XML API only. Migrations run on every start: games fetched before the poll existed and
-- still without it are marked stale once, so they get it when next asked for (not all at once).
ALTER TABLE game ADD COLUMN IF NOT EXISTS best_with text;
ALTER TABLE game ADD COLUMN IF NOT EXISTS recommended_with text;
UPDATE game SET fetched_at = '2000-01-01T00:00:00Z'
  WHERE best_with IS NULL AND recommended_with IS NULL AND fetched_at < '2026-11-06T00:00:00Z' AND fetched_at > '2000-01-01T00:00:00Z';
