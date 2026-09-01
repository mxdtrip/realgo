BEGIN;

CREATE TABLE password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX password_reset_tokens_user_idx
    ON password_reset_tokens (user_id, created_at DESC);

CREATE INDEX password_reset_tokens_expiry_idx
    ON password_reset_tokens (expires_at)
    WHERE used_at IS NULL;

CREATE UNIQUE INDEX password_reset_tokens_one_active_per_user_idx
    ON password_reset_tokens (user_id)
    WHERE used_at IS NULL;

COMMIT;
