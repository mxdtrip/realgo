package reports

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

const retentionCleanupInterval = 24 * time.Hour

// RunRetentionCleanup removes screenshot bytes after 30 days and complete
// reports after 90 days. It runs immediately at startup, then daily, and exits
// with the application context. Failures are logged and retried next cycle;
// they must not make the API unavailable.
func RunRetentionCleanup(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) {
	if logger == nil {
		logger = slog.Default()
	}
	queries := db.New(pool)
	cleanup := func() {
		screenshots, err := queries.ClearExpiredProblemReportScreenshots(ctx)
		if err != nil {
			logger.Error("problem report screenshot cleanup failed", slog.Any("err", err))
			return
		}
		reports, err := queries.DeleteExpiredProblemReports(ctx)
		if err != nil {
			logger.Error("problem report cleanup failed", slog.Any("err", err))
			return
		}
		if screenshots > 0 || reports > 0 {
			logger.Info("problem report retention cleanup completed",
				slog.Int64("screenshots_cleared", screenshots),
				slog.Int64("reports_deleted", reports),
			)
		}
	}

	cleanup()
	ticker := time.NewTicker(retentionCleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanup()
		}
	}
}
