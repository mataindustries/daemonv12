-- Work around Cloudflare D1 remote SQL trigger parsing: CASE..END must be parenthesized.
-- Apply with voting closed. D1 migrations are transactional: backfill and
-- triggers become visible together. The original votes remain authoritative.
CREATE TABLE vote_totals (
  experiment_id TEXT NOT NULL CHECK (experiment_id = 'one-sound-001'),
  track_id TEXT NOT NULL CHECK (track_id IN ('A','B','C')),
  count INTEGER NOT NULL CHECK (typeof(count) = 'integer' AND count >= 0),
  PRIMARY KEY (experiment_id, track_id)
);
INSERT INTO vote_totals(experiment_id, track_id, count)
SELECT 'one-sound-001', track_id,
  (SELECT COUNT(*) FROM votes WHERE experiment_id = 'one-sound-001' AND votes.track_id = tracks.track_id)
FROM (SELECT 'A' AS track_id UNION ALL SELECT 'B' UNION ALL SELECT 'C') AS tracks;

-- AFTER INSERT runs only for a row actually inserted, never an ignored retry.
-- A counter failure aborts the vote in the same transaction.
CREATE TRIGGER votes_total_insert AFTER INSERT ON votes BEGIN
  UPDATE vote_totals SET count = count + 1
    WHERE experiment_id = NEW.experiment_id AND track_id = NEW.track_id;
  SELECT (CASE WHEN changes() != 1 THEN RAISE(ABORT, 'missing vote total') END);
END;
CREATE TRIGGER votes_total_delete AFTER DELETE ON votes BEGIN
  UPDATE vote_totals SET count = count - 1
    WHERE experiment_id = OLD.experiment_id AND track_id = OLD.track_id;
  SELECT (CASE WHEN changes() != 1 THEN RAISE(ABORT, 'missing vote total') END);
END;
CREATE TRIGGER votes_immutable BEFORE UPDATE ON votes BEGIN
  SELECT RAISE(ABORT, 'votes are immutable');
END;
