-- 0005: BGG ratings (feature 005, research R1): the average and the Bayes average from api/dynamicinfo.
-- migrations run on every start: only games still without any rating are marked stale, so they are
-- fetched again on demand (rather than all at once).
ALTER TABLE game ADD COLUMN IF NOT EXISTS rating numeric(4,2);
ALTER TABLE game ADD COLUMN IF NOT EXISTS geek_rating numeric(4,2);
UPDATE game SET fetched_at = '2000-01-01T00:00:00Z' WHERE rating IS NULL AND geek_rating IS NULL;
