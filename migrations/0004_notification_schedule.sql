-- Scheduled (preview) notifications + email tracking.
-- A row with scheduled_for IS NOT NULL AND scheduled_for > now() is "upcoming"
-- and shown to the user as a preview. The cron promotes it (emails + sets
-- emailed_at) once the scheduled_for time passes.
ALTER TABLE notifications ADD COLUMN scheduled_for INTEGER;
ALTER TABLE notifications ADD COLUMN emailed_at INTEGER;

-- Existing rows were sent + emailed inline by the cron, so backfill emailed_at
-- to keep them out of the "needs emailing" sweep.
UPDATE notifications SET emailed_at = sent_at WHERE emailed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
  ON notifications(scheduled_for);
