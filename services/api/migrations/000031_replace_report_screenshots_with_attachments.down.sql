BEGIN;

DROP INDEX IF EXISTS problem_reports_attachment_expiry_idx;

ALTER TABLE problem_reports
    DROP CONSTRAINT IF EXISTS problem_reports_attachment_size,
    DROP CONSTRAINT IF EXISTS problem_reports_attachment_shape;

UPDATE problem_reports
SET attachment = NULL,
    attachment_mime = NULL,
    attachment_filename = NULL,
    attachment_size = NULL
WHERE attachment IS NOT NULL
  AND (
      attachment_mime NOT IN ('image/png', 'image/jpeg')
      OR octet_length(attachment) > 1048576
  );

ALTER TABLE problem_reports
    ADD COLUMN screenshot_width INTEGER,
    ADD COLUMN screenshot_height INTEGER;

UPDATE problem_reports
SET screenshot_width = 1,
    screenshot_height = 1
WHERE attachment IS NOT NULL;

ALTER TABLE problem_reports
    DROP COLUMN attachment_filename,
    DROP COLUMN attachment_size,
    ALTER COLUMN attachment_mime TYPE VARCHAR(20);

ALTER TABLE problem_reports
    RENAME COLUMN attachment_expires_at TO screenshot_expires_at;

ALTER TABLE problem_reports
    RENAME COLUMN attachment_mime TO screenshot_mime;

ALTER TABLE problem_reports
    RENAME COLUMN attachment TO screenshot;

ALTER TABLE problem_reports
    ADD CONSTRAINT problem_reports_screenshot_size CHECK (
        screenshot IS NULL OR octet_length(screenshot) <= 1048576
    ),
    ADD CONSTRAINT problem_reports_screenshot_shape CHECK (
        (screenshot IS NULL AND screenshot_mime IS NULL AND screenshot_width IS NULL AND screenshot_height IS NULL)
        OR
        (screenshot IS NOT NULL AND screenshot_mime IS NOT NULL AND screenshot_width > 0 AND screenshot_height > 0)
    );

CREATE INDEX problem_reports_screenshot_expiry_idx
    ON problem_reports (screenshot_expires_at)
    WHERE screenshot IS NOT NULL;

COMMIT;
