-- 0006: BGG's player poll (feature 006, FR-006a/b): the summary ("Best with 2–3 players", "Recommended with
-- 1–4 players") and the votes per player count, from the official XML API only. Migrations run on every start:
-- games fetched before the poll existed and still without it are marked stale, so they get it when next asked
-- for (not all at once); the date bound keeps later games without a poll (website data) from being re-marked.
ALTER TABLE game ADD COLUMN IF NOT EXISTS best_with text;
ALTER TABLE game ADD COLUMN IF NOT EXISTS recommended_with text;
ALTER TABLE game ADD COLUMN IF NOT EXISTS player_poll jsonb;
ALTER TABLE game ADD COLUMN IF NOT EXISTS player_poll_voters integer;
UPDATE game SET fetched_at = '2000-01-01T00:00:00Z'
  WHERE player_poll_voters IS NULL AND fetched_at < '2026-11-07T00:00:00Z' AND fetched_at > '2000-01-01T00:00:00Z';
