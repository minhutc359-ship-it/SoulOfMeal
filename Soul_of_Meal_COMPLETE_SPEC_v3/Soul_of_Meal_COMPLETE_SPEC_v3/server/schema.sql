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

ALTER TABLE som_accounts ADD COLUMN IF NOT EXISTS meta_state jsonb;

CREATE TABLE IF NOT EXISTS som_gacha_receipts (
    account_id uuid NOT NULL REFERENCES som_accounts(id) ON DELETE CASCADE,
    request_key uuid NOT NULL,
    receipt jsonb NOT NULL,
    PRIMARY KEY (account_id, request_key)
);

CREATE TABLE IF NOT EXISTS som_account_identities (
    provider text NOT NULL,
    subject text NOT NULL,
    account_id uuid NOT NULL REFERENCES som_accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (provider, subject)
);
