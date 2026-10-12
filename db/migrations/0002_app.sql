-- App-owned tables. Better Auth's tables live in 0001_better_auth.sql.

-- One fictional SIM line per account. Allowances run from 1e-31 GB to
-- 6.7e21 GB, so these need double precision: Better Auth's "number" field
-- type maps to integer and cannot hold them.
CREATE TABLE sim_line (
  user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  plan_id text,
  used_gb double precision NOT NULL DEFAULT 0 CHECK (used_gb >= 0),
  allowance_override_gb double precision CHECK (allowance_override_gb IS NULL OR allowance_override_gb >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Staff-visible activity history. No foreign keys on purpose: entries must
-- survive the deletion of the accounts they describe.
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id text,
  actor_email text,
  action text NOT NULL,
  target_id text,
  target_email text,
  detail text
);
CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);

-- Per-address email throttle. Stores a SHA-256 of the address, never the address.
CREATE TABLE email_log (
  id bigserial PRIMARY KEY,
  address_hash text NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_log_lookup_idx ON email_log (address_hash, kind, sent_at DESC);
