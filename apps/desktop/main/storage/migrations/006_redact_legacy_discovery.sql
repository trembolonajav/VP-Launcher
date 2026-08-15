-- Observations collected before endpoint normalization may contain volatile
-- identifiers in WebSocket paths. They are disposable discovery evidence and
-- must not survive the hardened collector rollout.
DELETE FROM discovery_observations;
DELETE FROM network_endpoints WHERE origin LIKE 'ws://%' OR origin LIKE 'wss://%';
