-- Per-key, per-window request counters for the rate limiter.
-- Key format: "<label>:<ip>:<email>" (e.g. "llm-min:1.2.3.4:test@example.com").
-- window_start is the unix epoch second of the bucket boundary.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
