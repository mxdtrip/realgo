BEGIN;

DROP TABLE oauth_accounts;

-- password_hash is intentionally left nullable: a NOT NULL rollback would fail
-- outright if any OAuth-only user (no local password) was created while this
-- migration was applied.

COMMIT;
