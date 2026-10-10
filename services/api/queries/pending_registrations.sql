-- name: CreatePendingRegistration :exec
INSERT INTO pending_registrations (email, password_hash, nickname, code_hash, expires_at, challenge_hash)
VALUES (
  sqlc.arg(email)::text,
  sqlc.arg(password_hash)::text,
  sqlc.narg(nickname)::text,
  sqlc.arg(code_hash)::char(64),
  sqlc.arg(expires_at)::timestamptz,
  sqlc.arg(challenge_hash)::text
)
ON CONFLICT (challenge_hash) DO NOTHING;

-- name: RefreshPendingRegistrationCode :one
UPDATE pending_registrations
SET code_hash = sqlc.arg(code_hash)::char(64),
    expires_at = sqlc.arg(expires_at)::timestamptz,
    updated_at = NOW()
WHERE email = sqlc.arg(email)::text
  AND challenge_hash = sqlc.arg(challenge_hash)::text
  AND expires_at > NOW()
RETURNING email;

-- name: ConsumePendingRegistration :one
DELETE FROM pending_registrations
WHERE email = sqlc.arg(email)::text
  AND challenge_hash = sqlc.arg(challenge_hash)::text
  AND code_hash = sqlc.arg(code_hash)::char(64)
  AND expires_at > NOW()
RETURNING email, password_hash, nickname;
