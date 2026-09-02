BEGIN;

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Grandfather existing accounts in so this migration does not lock anyone
-- who registered before email confirmation existed out of login.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX email_verifications_user_pending_idx
    ON email_verifications (user_id)
    WHERE consumed_at IS NULL;

COMMIT;
