-- F008: the person's BoardGameGeek username and the friends' BGG users they follow, synced like the
-- other app data (last write wins on updated_at, pulls filter by synced_at, ADR 0004)

CREATE TABLE IF NOT EXISTS user_setting (
  user_email    text        PRIMARY KEY,
  bgg_username  text        NULL CHECK (bgg_username IS NULL OR length(bgg_username) BETWEEN 1 AND 50),
  updated_at    timestamptz NOT NULL,
  synced_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_setting_user_synced_idx ON user_setting (user_email, synced_at);

CREATE TABLE IF NOT EXISTS followed_bgg_user (
  user_email  text        NOT NULL,
  bgg_user    text        NOT NULL CHECK (length(bgg_user) BETWEEN 1 AND 50),
  updated_at  timestamptz NOT NULL,
  deleted     boolean     NOT NULL DEFAULT false,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_email, bgg_user)
);
CREATE INDEX IF NOT EXISTS followed_bgg_user_user_synced_idx ON followed_bgg_user (user_email, synced_at);
