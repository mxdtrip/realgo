-- name: CreateEmailVerificationCode :exec
WITH revoked AS (
  UPDATE email_verification_codes SET used_at = NOW()
  WHERE user_id = sqlc.arg(user_id)::bigint AND used_at IS NULL
  RETURNING id
)
INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
SELECT sqlc.arg(user_id)::bigint, sqlc.arg(code_hash)::char(64), sqlc.arg(expires_at)::timestamptz
FROM (SELECT COUNT(*) FROM revoked) AS revocation_complete
ON CONFLICT DO NOTHING;

-- name: ConsumeEmailVerificationCode :one
WITH consumed AS (
  UPDATE email_verification_codes SET used_at = NOW()
  WHERE user_id = sqlc.arg(user_id)::bigint
    AND code_hash = sqlc.arg(code_hash)::char(64)
    AND used_at IS NULL AND expires_at > NOW()
  RETURNING user_id
)
UPDATE users SET email_verified_at = NOW(), updated_at = NOW()
WHERE id = (SELECT user_id FROM consumed)
RETURNING id;
