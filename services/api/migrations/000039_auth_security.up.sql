BEGIN;
CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
DELETE FROM pending_registrations; -- Legacy challenges had no browser binding.
ALTER TABLE pending_registrations ADD COLUMN challenge_hash TEXT NOT NULL;
ALTER TABLE pending_registrations DROP CONSTRAINT pending_registrations_email_key;
ALTER TABLE pending_registrations ADD CONSTRAINT pending_registrations_challenge_key UNIQUE(challenge_hash);
-- Multiple independently issued links stay valid until one is used. Never
-- silently drop a concurrent INSERT and email an unpersisted credential.
DROP INDEX IF EXISTS password_reset_tokens_one_active_per_user_idx;
CREATE TABLE auth_mail_jobs (
    id BIGSERIAL PRIMARY KEY,
    payload BYTEA NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
);
CREATE INDEX auth_mail_jobs_available_idx ON auth_mail_jobs(available_at);
-- The database is the revocation authority even when Redis is unavailable.
CREATE FUNCTION revoke_password_credentials() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        DELETE FROM auth_sessions WHERE user_id = NEW.id;
        UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = NEW.id AND used_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER users_revoke_password_credentials AFTER UPDATE OF password_hash ON users
FOR EACH ROW EXECUTE FUNCTION revoke_password_credentials();
COMMIT;
