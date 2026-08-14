CREATE INDEX idx_session_runs_account_started ON session_runs(account_id, started_at DESC);
CREATE INDEX idx_session_runs_open ON session_runs(ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_events_account_time ON events(account_id, occurred_at DESC);
CREATE INDEX idx_events_type_time ON events(type, occurred_at DESC);
