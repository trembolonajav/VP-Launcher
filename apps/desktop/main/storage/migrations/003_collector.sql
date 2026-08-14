CREATE TABLE telemetry_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_run_id INTEGER REFERENCES session_runs(id) ON DELETE SET NULL,
  captured_at TEXT NOT NULL,
  player_level INTEGER,
  player_xp REAL,
  pokemon_name TEXT,
  pokemon_level INTEGER,
  pokemon_hp INTEGER,
  location TEXT,
  bag_used INTEGER,
  bag_capacity INTEGER,
  gold INTEGER,
  balls INTEGER,
  snapshot_json TEXT NOT NULL
);
CREATE TABLE game_events (id INTEGER PRIMARY KEY AUTOINCREMENT,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,session_run_id INTEGER REFERENCES session_runs(id) ON DELETE SET NULL,occurred_at TEXT NOT NULL,type TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE network_endpoints (id INTEGER PRIMARY KEY AUTOINCREMENT,origin TEXT NOT NULL,path_pattern TEXT NOT NULL,method TEXT NOT NULL,resource_type TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,seen_count INTEGER NOT NULL DEFAULT 1,UNIQUE(origin,path_pattern,method,resource_type));
CREATE TABLE map_observations (map_key TEXT PRIMARY KEY,label TEXT NOT NULL,level INTEGER,city TEXT,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,seen_count INTEGER NOT NULL DEFAULT 1,metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE ui_discoveries (fingerprint TEXT PRIMARY KEY,surface TEXT NOT NULL,label TEXT,selector_hint TEXT,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,seen_count INTEGER NOT NULL DEFAULT 1,metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE discovery_runs (id INTEGER PRIMARY KEY AUTOINCREMENT,account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,started_at TEXT NOT NULL,ended_at TEXT,mode TEXT NOT NULL,reason TEXT);
CREATE INDEX idx_telemetry_account_time ON telemetry_samples(account_id,captured_at DESC);
CREATE INDEX idx_game_events_account_time ON game_events(account_id,occurred_at DESC);
CREATE INDEX idx_network_endpoints_seen ON network_endpoints(last_seen_at DESC);
