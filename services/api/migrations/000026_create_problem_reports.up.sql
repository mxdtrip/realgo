BEGIN;

CREATE TABLE problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schema_version SMALLINT NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) BETWEEN 4 AND 2000),
    diagnostics JSONB NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    release_version VARCHAR(100),
    commit_sha VARCHAR(64),
    source_request_id VARCHAR(200) NOT NULL,
    screenshot BYTEA,
    screenshot_mime VARCHAR(20),
    screenshot_width INTEGER,
    screenshot_height INTEGER,
    screenshot_expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    CONSTRAINT problem_reports_screenshot_size CHECK (
        screenshot IS NULL OR octet_length(screenshot) <= 1048576
    ),
    CONSTRAINT problem_reports_screenshot_shape CHECK (
        (screenshot IS NULL AND screenshot_mime IS NULL AND screenshot_width IS NULL AND screenshot_height IS NULL)
        OR
        (screenshot IS NOT NULL AND screenshot_mime IS NOT NULL AND screenshot_width > 0 AND screenshot_height > 0)
    )
);

CREATE INDEX problem_reports_fingerprint_created_idx
    ON problem_reports (fingerprint, created_at DESC);

CREATE INDEX problem_reports_user_created_idx
    ON problem_reports (user_id, created_at DESC);

CREATE INDEX problem_reports_expiry_idx
    ON problem_reports (expires_at);

CREATE INDEX problem_reports_screenshot_expiry_idx
    ON problem_reports (screenshot_expires_at)
    WHERE screenshot IS NOT NULL;

COMMIT;
