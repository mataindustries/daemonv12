CREATE TABLE votes (
  experiment_id TEXT NOT NULL CHECK (experiment_id = 'one-sound-001'),
  voter_hash TEXT NOT NULL,
  track_id TEXT NOT NULL CHECK (track_id IN ('A','B','C')),
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (experiment_id, voter_hash),
  UNIQUE (experiment_id, request_id)
);
CREATE INDEX votes_counts ON votes(experiment_id, track_id);
-- Only rotating HMAC keys are stored here, never IPs or cookie identifiers.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);
