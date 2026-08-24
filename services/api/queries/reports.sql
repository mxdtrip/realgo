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
    attachment,
    attachment_mime,
    attachment_filename,
    attachment_size
) VALUES (
    sqlc.arg(user_id),
    sqlc.arg(schema_version),
    sqlc.arg(description),
    sqlc.arg(diagnostics),
    sqlc.arg(fingerprint),
    sqlc.narg(release_version),
    sqlc.narg(commit_sha),
    sqlc.arg(source_request_id),
    sqlc.narg(attachment),
    sqlc.narg(attachment_mime),
    sqlc.narg(attachment_filename),
    sqlc.narg(attachment_size)
)
RETURNING id::text AS report_id, created_at;

-- name: ClearExpiredProblemReportAttachments :execrows
UPDATE problem_reports
SET attachment = NULL,
    attachment_mime = NULL,
    attachment_filename = NULL,
    attachment_size = NULL
WHERE attachment IS NOT NULL
  AND attachment_expires_at <= CURRENT_TIMESTAMP;

-- name: DeleteExpiredProblemReports :execrows
DELETE FROM problem_reports
WHERE expires_at <= CURRENT_TIMESTAMP;
