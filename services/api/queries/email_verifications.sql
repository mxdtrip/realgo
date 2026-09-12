-- name: CreateEmailVerification :one
INSERT INTO email_verifications (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ExpirePendingEmailVerifications :exec
-- Invalidates any earlier unconsumed links for the user so only the most
-- recently sent one (register or resend) can still be used.
UPDATE email_verifications
SET consumed_at = NOW()
WHERE user_id = $1 AND consumed_at IS NULL;

-- name: GetEmailVerificationByID :one
SELECT * FROM email_verifications
WHERE id = $1;

-- name: ConsumeEmailVerification :execrows
UPDATE email_verifications
SET consumed_at = NOW()
WHERE id = $1 AND consumed_at IS NULL;

-- name: MarkUserEmailVerified :execrows
UPDATE users
SET email_verified_at = NOW(), updated_at = NOW()
WHERE id = $1 AND email_verified_at IS NULL;
