-- When the server received each row. Pulls filter by it, not by the device's updatedAt: a change made
-- offline and sent later carries an old updatedAt but must still reach devices that synced meanwhile.

ALTER TABLE collection       ADD COLUMN IF NOT EXISTS synced_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE collection_entry ADD COLUMN IF NOT EXISTS synced_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE loaded_list      ADD COLUMN IF NOT EXISTS synced_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS collection_user_synced_idx       ON collection (user_email, synced_at);
CREATE INDEX IF NOT EXISTS collection_entry_user_synced_idx ON collection_entry (user_email, synced_at);
CREATE INDEX IF NOT EXISTS loaded_list_user_synced_idx      ON loaded_list (user_email, synced_at);
