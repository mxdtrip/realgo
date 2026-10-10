BEGIN;

DROP INDEX IF EXISTS problem_reports_screenshot_expiry_idx;

ALTER TABLE problem_reports
    DROP CONSTRAINT IF EXISTS problem_reports_screenshot_size,
    DROP CONSTRAINT IF EXISTS problem_reports_screenshot_shape;

ALTER TABLE problem_reports
    RENAME COLUMN screenshot TO attachment;

ALTER TABLE problem_reports
    RENAME COLUMN screenshot_mime TO attachment_mime;

ALTER TABLE problem_reports
    RENAME COLUMN screenshot_expires_at TO attachment_expires_at;

ALTER TABLE problem_reports
    DROP COLUMN screenshot_width,
    DROP COLUMN screenshot_height,
    ALTER COLUMN attachment_mime TYPE VARCHAR(100),
    ADD COLUMN attachment_filename VARCHAR(255),
    ADD COLUMN attachment_size INTEGER;

UPDATE problem_reports
SET attachment_filename = CASE attachment_mime
        WHEN 'image/png' THEN 'screenshot.png'
        WHEN 'image/jpeg' THEN 'screenshot.jpg'
        ELSE 'attachment'
    END,
    attachment_size = octet_length(attachment)
WHERE attachment IS NOT NULL;

ALTER TABLE problem_reports
    ADD CONSTRAINT problem_reports_attachment_size CHECK (
        attachment IS NULL
        OR
        (
            attachment_size = octet_length(attachment)
            AND (
                (attachment_mime LIKE 'video/%' AND attachment_size <= 15728640)
                OR
                (attachment_mime NOT LIKE 'video/%' AND attachment_size <= 5242880)
            )
        )
    ),
    ADD CONSTRAINT problem_reports_attachment_shape CHECK (
        (attachment IS NULL AND attachment_mime IS NULL AND attachment_filename IS NULL AND attachment_size IS NULL)
        OR
        (attachment IS NOT NULL AND attachment_mime IS NOT NULL AND attachment_filename IS NOT NULL AND attachment_size > 0)
    );

CREATE INDEX problem_reports_attachment_expiry_idx
    ON problem_reports (attachment_expires_at)
    WHERE attachment IS NOT NULL;

COMMIT;
