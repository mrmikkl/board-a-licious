-- 0004: no Essen type anymore (spec Clarifications 2026-10-18); game info for the rows (FR-010).
-- Collections and lists lose their Essen flag; entries keep the edition a list offers; games keep
-- players, designers, mechanisms and their first publisher. Cached games are fetched again.

ALTER TABLE collection DROP COLUMN IF EXISTS type;
ALTER TABLE loaded_list DROP COLUMN IF EXISTS is_essen;

ALTER TABLE collection_entry ADD COLUMN IF NOT EXISTS edition text;

ALTER TABLE game ADD COLUMN IF NOT EXISTS min_players integer;
ALTER TABLE game ADD COLUMN IF NOT EXISTS max_players integer;
ALTER TABLE game ADD COLUMN IF NOT EXISTS designers jsonb NOT NULL DEFAULT '[]';
ALTER TABLE game ADD COLUMN IF NOT EXISTS mechanisms jsonb NOT NULL DEFAULT '[]';
ALTER TABLE game ADD COLUMN IF NOT EXISTS publisher text;
-- migrations run on every start: only games still without any info are marked stale
UPDATE game SET fetched_at = '2000-01-01T00:00:00Z' WHERE min_players IS NULL AND designers = '[]'::jsonb;
