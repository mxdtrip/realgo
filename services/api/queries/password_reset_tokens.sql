-- name: CreatePasswordResetToken :exec
INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES (sqlc.arg(user_id)::bigint, sqlc.arg(token_hash)::char(64), sqlc.arg(expires_at)::timestamptz);

-- name: ConsumePasswordResetToken :one
UPDATE password_reset_tokens SET used_at = NOW()
WHERE token_hash = sqlc.arg(token_hash)::char(64)
  AND used_at IS NULL AND expires_at > NOW()
RETURNING user_id;
