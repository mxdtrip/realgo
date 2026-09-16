BEGIN;

-- Migration 37 retains this table on partial rollback for databases restored
-- from production. A full schema teardown must remove its users dependency.
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS users;

COMMIT;
