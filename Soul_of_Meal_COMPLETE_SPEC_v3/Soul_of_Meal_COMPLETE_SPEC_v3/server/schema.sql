CREATE TABLE IF NOT EXISTS som_accounts (
    id uuid PRIMARY KEY,
    username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    practice_save jsonb,
    save_revision integer NOT NULL DEFAULT 0 CHECK (save_revision >= 0)
);

CREATE TABLE IF NOT EXISTS som_sessions (
    session_key text PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES som_accounts(id) ON DELETE CASCADE,
    ticket bytea NOT NULL,
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS som_sessions_expiry ON som_sessions(expires_at);
