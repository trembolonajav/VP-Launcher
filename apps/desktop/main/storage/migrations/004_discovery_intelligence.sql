CREATE TABLE discovery_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discovery_run_id INTEGER REFERENCES discovery_runs(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  category TEXT NOT NULL,
  direction TEXT,
  target TEXT,
  ui_surface TEXT,
  location TEXT,
  size_bytes INTEGER,
  fingerprint TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE storage_key_observations (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  storage_type TEXT NOT NULL,
  key_name TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(account_id,storage_type,key_name)
);
CREATE INDEX idx_discovery_observations_run_time ON discovery_observations(discovery_run_id,occurred_at DESC);
CREATE INDEX idx_discovery_observations_account_time ON discovery_observations(account_id,occurred_at DESC);
