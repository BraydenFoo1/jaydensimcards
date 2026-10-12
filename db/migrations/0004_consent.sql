-- Minimal record that an account agreed to a specific version of a legal
-- document at sign-up: which document, which version, when. Nothing else.
CREATE TABLE consent_record (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  document text NOT NULL CHECK (document IN ('terms', 'privacy')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_record_user_idx ON consent_record (user_id);
