ALTER TABLE notifications ADD COLUMN dedup_key TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(lawn_id, dedup_key);
