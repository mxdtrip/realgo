BEGIN;

DROP TABLE email_verifications;
ALTER TABLE users DROP COLUMN email_verified_at;

COMMIT;
