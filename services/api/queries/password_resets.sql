-- name: CreatePasswordReset :one
INSERT INTO password_resets (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ExpirePendingPasswordResets :exec
-- Invalidates any earlier unconsumed links for the user so only the most
-- recently requested one can still be used.
UPDATE password_resets
SET consumed_at = NOW()
WHERE user_id = $1 AND consumed_at IS NULL;

-- name: GetPasswordResetByID :one
SELECT * FROM password_resets
WHERE id = $1;

-- name: ConsumePasswordReset :execrows
UPDATE password_resets
SET consumed_at = NOW()
WHERE id = $1 AND consumed_at IS NULL;
