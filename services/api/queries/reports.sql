-- name: CreateProblemReport :one
INSERT INTO problem_reports (
    user_id,
    schema_version,
    description,
    diagnostics,
    fingerprint,
    release_version,
    commit_sha,
    source_request_id,
    screenshot,
    screenshot_mime,
    screenshot_width,
    screenshot_height
) VALUES (
    sqlc.arg(user_id),
    sqlc.arg(schema_version),
    sqlc.arg(description),
    sqlc.arg(diagnostics),
    sqlc.arg(fingerprint),
    sqlc.narg(release_version),
    sqlc.narg(commit_sha),
    sqlc.arg(source_request_id),
    sqlc.narg(screenshot),
    sqlc.narg(screenshot_mime),
    sqlc.narg(screenshot_width),
    sqlc.narg(screenshot_height)
)
RETURNING id::text AS report_id, created_at;

-- name: ClearExpiredProblemReportScreenshots :execrows
UPDATE problem_reports
SET screenshot = NULL,
    screenshot_mime = NULL,
    screenshot_width = NULL,
    screenshot_height = NULL
WHERE screenshot IS NOT NULL
  AND screenshot_expires_at <= CURRENT_TIMESTAMP;

-- name: DeleteExpiredProblemReports :execrows
DELETE FROM problem_reports
WHERE expires_at <= CURRENT_TIMESTAMP;
