-- Data minimisation for the activity log.
-- Entries keep opaque account ids only; names and emails are looked up when the
-- log is displayed. Deleting an account therefore removes its personal data
-- from the log as well, while the record of what happened stays intact.
ALTER TABLE audit_log DROP COLUMN actor_email;
ALTER TABLE audit_log DROP COLUMN target_email;
CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action, created_at DESC);
