ALTER TABLE discovery_observations ADD COLUMN last_seen_at TEXT;
ALTER TABLE discovery_observations ADD COLUMN seen_count INTEGER NOT NULL DEFAULT 1;
UPDATE discovery_observations SET last_seen_at=occurred_at WHERE last_seen_at IS NULL;
UPDATE discovery_observations AS target
SET seen_count=(SELECT COUNT(*) FROM discovery_observations AS source WHERE source.discovery_run_id=target.discovery_run_id AND source.fingerprint=target.fingerprint),
    last_seen_at=(SELECT MAX(occurred_at) FROM discovery_observations AS source WHERE source.discovery_run_id=target.discovery_run_id AND source.fingerprint=target.fingerprint)
WHERE id=(SELECT MIN(id) FROM discovery_observations AS source WHERE source.discovery_run_id=target.discovery_run_id AND source.fingerprint=target.fingerprint);
DELETE FROM discovery_observations
WHERE id NOT IN (SELECT MIN(id) FROM discovery_observations GROUP BY discovery_run_id,fingerprint);
CREATE UNIQUE INDEX idx_discovery_observations_run_fingerprint ON discovery_observations(discovery_run_id,fingerprint);
