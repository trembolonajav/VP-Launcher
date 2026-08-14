CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  username TEXT NOT NULL,
  secret_blob BLOB NOT NULL,
  auto_login INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE network_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DIRECT','SYSTEM','PROXY','PROTON')),
  config_json TEXT NOT NULL DEFAULT '{}',
  credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE automation_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  game_url TEXT NOT NULL,
  partition_name TEXT NOT NULL UNIQUE,
  credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  network_profile_id TEXT REFERENCES network_profiles(id) ON DELETE SET NULL,
  preset_id TEXT REFERENCES automation_presets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE session_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT,
  app_version TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  session_run_id INTEGER REFERENCES session_runs(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
