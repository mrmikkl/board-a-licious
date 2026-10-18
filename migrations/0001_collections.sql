-- Collections and entries per person, plus the shared BGG game cache (data-model.md)

CREATE TABLE IF NOT EXISTS collection (
  id          uuid        PRIMARY KEY,
  user_email  text        NOT NULL,            -- verified Access email, lowercased
  name        text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  type        text        NOT NULL CHECK (type IN ('essen', 'standard')),
  updated_at  timestamptz NOT NULL,
  deleted     boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS collection_user_email_idx ON collection (user_email);

CREATE TABLE IF NOT EXISTS collection_entry (
  collection_id   uuid        NOT NULL REFERENCES collection (id),
  bgg_id          integer     NOT NULL CHECK (bgg_id > 0),
  user_email      text        NOT NULL,        -- denormalised for the per-user filter
  mark            text        NOT NULL DEFAULT 'new',
  bought          boolean     NOT NULL DEFAULT false,
  paid_cents      integer     CHECK (paid_cents >= 0),
  paid_currency   text        CHECK (paid_currency ~ '^[A-Z]{3}$'),
  booth           text,
  price_cents     integer     CHECK (price_cents >= 0),
  currency        text,
  publisher       text,
  facts_source    text        CHECK (facts_source IN ('preview', 'manual')),
  details_pending boolean     NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL,
  deleted         boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (collection_id, bgg_id),
  CHECK (paid_currency IS NULL OR paid_cents IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS collection_entry_user_updated_idx ON collection_entry (user_email, updated_at);

CREATE TABLE IF NOT EXISTS game (               -- public BGG display data, shared by all users
  bgg_id        integer PRIMARY KEY,
  name          text NOT NULL,
  year          integer,
  thumbnail_url text,
  description   text,
  kind          text NOT NULL DEFAULT 'boardgame',
  fetched_at    timestamptz NOT NULL
);
