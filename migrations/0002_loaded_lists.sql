-- BGG lists a person loaded, so their other devices show them too (the games load per device)

CREATE TABLE IF NOT EXISTS loaded_list (
  user_email  text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('preview', 'geeklist')),
  list_id     integer     NOT NULL CHECK (list_id > 0),
  title       text        NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  is_essen    boolean     NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL,
  deleted     boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (user_email, kind, list_id)
);
CREATE INDEX IF NOT EXISTS loaded_list_user_updated_idx ON loaded_list (user_email, updated_at);
