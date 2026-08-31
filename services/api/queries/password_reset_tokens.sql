-- name: CreatePasswordResetToken :exec
-- Reissuing a token invalidates all previous unused links for this account.
WITH revoked AS (
  UPDATE password_reset_tokens
  SET used_at = NOW()
  WHERE user_id = sqlc.arg(user_id)::bigint
    AND used_at IS NULL
)
INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES (
  sqlc.arg(user_id)::bigint,
  sqlc.arg(token_hash)::char(64),
  sqlc.arg(expires_at)::timestamptz
)
ON CONFLICT DO NOTHING;

-- name: ConsumePasswordResetToken :one
-- The update is atomic, so a link can only be consumed once.
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE token_hash = sqlc.arg(token_hash)::char(64)
  AND used_at IS NULL
  AND expires_at > NOW()
RETURNING user_id;
