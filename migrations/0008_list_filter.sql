-- 0008: the list filter (feature 009). BGG's playing time per game, and the person's three length limits
-- (where Short, Middle and Long end; null = 30 / 60 / 120), synced like the BGG username.
-- Migrations run on every migrate: games stored before the playing time existed are marked stale only
-- when the column is added, so they get it when next asked for (not all at once, constitution V) and
-- games read since then stay fresh. The Worker adds the column the same way if it runs first
-- (repository.ts ensureGameColumns).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'game' AND column_name = 'playing_time') THEN
    ALTER TABLE game ADD COLUMN playing_time integer;
    UPDATE game SET fetched_at = '1970-01-01T00:00:00Z';
  END IF;
END
$$;
ALTER TABLE user_setting ADD COLUMN IF NOT EXISTS length_limits jsonb;
