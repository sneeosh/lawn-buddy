-- Single-device-per-email guard: stops two browsers from sharing one account.
-- Set when the user first claims the email; subsequent requests must match.
ALTER TABLE users ADD COLUMN device_id TEXT;
