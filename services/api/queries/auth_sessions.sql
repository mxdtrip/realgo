-- name: GetAuthSession :one
SELECT * FROM auth_sessions WHERE id = $1 AND expires_at > NOW();

-- name: DeleteAuthSessions :exec
DELETE FROM auth_sessions WHERE user_id = $1;
