BEGIN;
DROP TABLE IF EXISTS email_verification_codes;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
-- password_reset_tokens may predate this migration in a restored production
-- snapshot (the branches once used conflicting migration numbers), so never
-- destroy recovery credentials during a staging rollback.
COMMIT;
