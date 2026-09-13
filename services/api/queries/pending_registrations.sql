-- name: CreatePendingRegistration :exec
INSERT INTO pending_registrations (email, password_hash, nickname, code_hash, expires_at)
VALUES (
  sqlc.arg(email)::text,
  sqlc.arg(password_hash)::text,
  sqlc.narg(nickname)::text,
  sqlc.arg(code_hash)::char(64),
  sqlc.arg(expires_at)::timestamptz
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  nickname = EXCLUDED.nickname,
  code_hash = EXCLUDED.code_hash,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

-- name: RefreshPendingRegistrationCode :one
UPDATE pending_registrations
SET code_hash = sqlc.arg(code_hash)::char(64),
    expires_at = sqlc.arg(expires_at)::timestamptz,
    updated_at = NOW()
WHERE email = sqlc.arg(email)::text
RETURNING email;

-- name: ConsumePendingRegistration :one
DELETE FROM pending_registrations
WHERE email = sqlc.arg(email)::text
  AND code_hash = sqlc.arg(code_hash)::char(64)
  AND expires_at > NOW()
RETURNING email, password_hash, nickname;
