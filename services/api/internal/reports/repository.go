package reports

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

type pgRepository struct{ q *db.Queries }

func NewRepository(pool *pgxpool.Pool) *pgRepository { return &pgRepository{q: db.New(pool)} }

func (r *pgRepository) Create(ctx context.Context, userID int64, input CreateInput) (string, time.Time, error) {
	row, err := r.q.CreateProblemReport(ctx, db.CreateProblemReportParams{
		UserID: userID, SchemaVersion: input.SchemaVersion, Description: input.Description,
		Diagnostics: input.Diagnostics, Fingerprint: input.Fingerprint,
		ReleaseVersion: optionalText(input.ReleaseVersion), CommitSha: optionalText(input.CommitSHA),
		SourceRequestID: input.SourceRequestID, Attachment: input.Attachment,
		AttachmentMime:     optionalText(input.AttachmentMIME),
		AttachmentFilename: optionalText(input.AttachmentName),
		AttachmentSize:     optionalInt4(input.AttachmentSize),
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("reports: create: %w", err)
	}
	return row.ReportID, row.CreatedAt.Time.UTC(), nil
}

func optionalText(value string) pgtype.Text { return pgtype.Text{String: value, Valid: value != ""} }
func optionalInt4(value int32) pgtype.Int4  { return pgtype.Int4{Int32: value, Valid: value > 0} }
