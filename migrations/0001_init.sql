-- Lawn Buddy initial schema.
-- Email is the de facto user identifier (no auth in v1).

CREATE TABLE IF NOT EXISTS users (
  email      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lawns (
  id              TEXT PRIMARY KEY,
  user_email      TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  climate_zone    TEXT NOT NULL,
  intake_json     TEXT,
  soil_test_json  TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_lawns_user ON lawns(user_email);

CREATE TABLE IF NOT EXISTS photos (
  id        TEXT PRIMARY KEY,
  lawn_id   TEXT NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
  r2_key    TEXT NOT NULL,
  source    TEXT NOT NULL CHECK (source IN ('onboarding', 'chat')),
  taken_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_photos_lawn ON photos(lawn_id, taken_at);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  lawn_id         TEXT NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  photo_ids_json  TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_messages_lawn_created ON messages(lawn_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id        TEXT PRIMARY KEY,
  lawn_id   TEXT NOT NULL REFERENCES lawns(id) ON DELETE CASCADE,
  type      TEXT NOT NULL CHECK (type IN ('seasonal', 'weather')),
  title     TEXT NOT NULL,
  body      TEXT NOT NULL,
  sent_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  read_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notifications_lawn ON notifications(lawn_id, sent_at);
