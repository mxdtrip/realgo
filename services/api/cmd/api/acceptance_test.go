package main_test

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/realgo/services/api/internal/scheduler"
	"github.com/mxdtrip/realgo/services/api/internal/specifications"
	httpdriver "github.com/mxdtrip/realgo/services/api/internal/testdriver/http"
	"github.com/mxdtrip/realgo/services/api/internal/testutil"
	"github.com/mxdtrip/realgo/services/api/migrations"
)

// harness — общая пара контейнеров testcontainers, которая запускается
// один раз в TestMain и переиспользуется всеми acceptance-тестами пакета.
// Изоляция между тестами обеспечивается вызовом harness.Reset,
// а не созданием новых контейнеров (это слишком медленно для обычного
// цикла разработки).
var harness *testutil.Harness

// TestMain один раз запускает Harness с Postgres и Redis для всего пакета.
// При запуске с флагом -short контейнеры не поднимаются, поэтому быстрый
// цикл unit-тестов (go test -short ./...) не требует Docker.
func TestMain(m *testing.M) {
	// К моменту вызова TestMain flag.Parse ещё не выполнен, а вызов
	// testing.Short до разбора флагов приводит к panic
	// Поэтому разбираем флаги явно.
	flag.Parse()

	if testing.Short() {
		os.Exit(m.Run())
	}

	h, err := testutil.Start(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "acceptance: failed to start harness:", err)
		os.Exit(1)
	}
	harness = h

	code := m.Run()
	harness.Stop()
	os.Exit(code)
}

// TestAcceptance_HarnessWalkingSkeleton — цель
// доказать, что весь конвейер работает.
//
// testcontainers с Postgres 16 и Redis 7 → настоящий server.New,
// запущенный через httptest → реальный POST /auth/register,
// возвращающий JWT → GET /me с Bearer-токеном,
// возвращающий email зарегистрированного пользователя.
//
// Здесь нет заглушек — используются только реальные компоненты системы.
func TestAcceptance_HarnessWalkingSkeleton(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	harness.Reset(t)

	d := httpdriver.New(t, harness)
	defer d.Close()

	specifications.HarnessSpecification(t, d)
}

func TestAcceptance_AdminContentMigration(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	ctx := context.Background()
	tx, err := harness.Pool.Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, tx.Rollback(ctx)) })
	applyMigration(t, ctx, tx, "000032_expand_admin_menu.down.sql")
	applyMigration(t, ctx, tx, "000032_expand_admin_menu.up.sql")
	applyMigration(t, ctx, tx, "000031_admin_content_crud.down.sql")
	applyMigration(t, ctx, tx, "000031_admin_content_crud.up.sql")

	var menuCount, distinctMenuCount, missingRoleMenus int
	require.NoError(t, tx.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(DISTINCT uuid)
		FROM goadmin_menu WHERE uuid LIKE 'realgo-%'
	`).Scan(&menuCount, &distinctMenuCount))
	require.Equal(t, 31, menuCount)
	require.Equal(t, menuCount, distinctMenuCount)
	require.NoError(t, tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM goadmin_menu menu
		WHERE menu.uuid LIKE 'realgo-%'
		  AND NOT EXISTS (
			SELECT 1 FROM goadmin_role_menu role_menu
			WHERE role_menu.role_id = 1 AND role_menu.menu_id = menu.id
		  )
	`).Scan(&missingRoleMenus))
	require.Zero(t, missingRoleMenus)

	var platformID, problemID, relationID int64
	require.NoError(t, tx.QueryRow(ctx, `
		INSERT INTO platforms (code, name, base_url)
		VALUES ('admin-migration-test', 'Admin migration test', 'https://example.test')
		RETURNING id
	`).Scan(&platformID))
	require.NoError(t, tx.QueryRow(ctx, `
		INSERT INTO problems (platform_id, external_slug, title, url, source_type)
		VALUES ($1, 'admin-migration-test', 'Admin migration test', 'https://example.test/p', 'manual')
		RETURNING id
	`, platformID).Scan(&problemID))
	require.NoError(t, tx.QueryRow(ctx, `
		INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier)
		SELECT $1, id, 'core' FROM patterns WHERE kind = 'subpattern' LIMIT 1
		RETURNING admin_id
	`, problemID).Scan(&relationID))
	require.Positive(t, relationID)

	blocked, err := tx.Begin(ctx)
	require.NoError(t, err)
	_, err = blocked.Exec(ctx, `DELETE FROM problems WHERE id = $1`, problemID)
	require.Error(t, err)
	require.NoError(t, blocked.Rollback(ctx))

	_, err = tx.Exec(ctx, `DELETE FROM problem_subpatterns WHERE admin_id = $1`, relationID)
	require.NoError(t, err)
	_, err = tx.Exec(ctx, `DELETE FROM problems WHERE id = $1`, problemID)
	require.NoError(t, err)
}

func applyMigration(t *testing.T, ctx context.Context, tx pgx.Tx, name string) {
	t.Helper()
	raw, err := migrations.FS.ReadFile(name)
	require.NoError(t, err)
	sql := strings.TrimSpace(string(raw))
	sql = strings.TrimSpace(strings.TrimPrefix(sql, "BEGIN;"))
	sql = strings.TrimSpace(strings.TrimSuffix(sql, "COMMIT;"))
	_, err = tx.Exec(ctx, sql)
	require.NoError(t, err)
}

// TestAcceptance_Cards — north-star acceptance-тесты для cards-модуля.
//
// Проверяет три ключевых user-journey:
//   - List: ученик видит свои карточки; непроходённая показана как "new"
//   - Session: ученик стартует сессию "due" и получает due-карточки
//   - Rate: после оценки карточка уходит в будущее; при "hard" возвращается в сессию
//
// Карточки создаются через POST /me/cards (CRUD), а не через SQL-seeds,
// что сохраняет black-box свойство теста.
func TestAcceptance_Cards(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	harness.Reset(t)

	d := httpdriver.New(t, harness)
	defer d.Close()

	specifications.CardsSpecification(t, d)
}

// TestAcceptance_Quiz — acceptance-тесты для интеграции Quiz и FSRS.
func TestAcceptance_Quiz(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	harness.Reset(t)

	d := httpdriver.New(t, harness)
	defer d.Close()

	specifications.QuizSpecification(t, d, d, d)
}

// TestAcceptance_FSRS — north-star acceptance-тесты для FSRS-движка.
//
// Каждый под-тест — отдельный outer-loop цикл ATDD из плана A1+A2:
//
//   - retention_affects_intervals (A2): retention из конфигурации приложения
//     доходит до FSRS-движка и влияет на интервалы. Драйвер поднимается дважды
//     с разным request_retention через httpdriver.WithFSRS.
//   - paths_share_algorithm (A1): оба пути планирования (extension-event и
//     review-rate) используют один scheduler, поэтому для одинакового
//     first-rating выдают одинаковый интервал.
//
// build tag'а нет: как и остальные acceptance-тесты, они skip'аются в -short.
func TestAcceptance_FSRS(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	t.Run("retention_affects_intervals", func(t *testing.T) {
		harness.Reset(t)

		// Независимые системы с разным request_retention. Каждая поднимает свой
		// httptest.Server на общем harness (изоляция — через harness.Reset в
		// начале теста и разные email'ы внутри спецификации).
		low := httpdriver.New(t, harness, httpdriver.WithFSRS(scheduler.Config{RequestRetention: 0.85}))
		defer low.Close()
		high := httpdriver.New(t, harness, httpdriver.WithFSRS(scheduler.Config{RequestRetention: 0.99}))
		defer high.Close()

		specifications.FSRSRetentionAffectsIntervals(t, low, high)
	})

	t.Run("paths_share_algorithm", func(t *testing.T) {
		harness.Reset(t)

		// Один driver — один scheduler для обоих путей. Retention не важен для
		// этого инварианта, лишь бы был один и тот же scheduler.
		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSPathsShareAlgorithm(t, d)
	})

	t.Run("unrated_card_has_no_or_canonical_state", func(t *testing.T) {
		harness.Reset(t)

		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSUnratedCardHasNoOrCanonicalState(t, d, d)
	})

	t.Run("first_rate_computes_canonical_state", func(t *testing.T) {
		harness.Reset(t)

		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSFirstRateComputesCanonicalState(t, d, d)
	})

	t.Run("manual_rate_replay_advances", func(t *testing.T) {
		harness.Reset(t)

		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSManualRateReplayAdvances(t, d, d)
	})
	// reviewed_at_clamped — (clamp reviewedAt):
	// будущее → now, прошлое до last_review_at → last_review_at.
	// Один драйвер с дефолтным scheduler.Config достаточен: инвариант не
	// зависит от retention.
	t.Run("reviewed_at_clamped", func(t *testing.T) {
		harness.Reset(t)

		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSReviewedAtClamped(t, d)
	})

	// extension_concurrent_ingest — (W2):
	// два параллельных solved-события с разными eventId не должны приводить
	// к lost update: review_count в итоге равен 2, а не 1.
	t.Run("extension_concurrent_ingest", func(t *testing.T) {
		harness.Reset(t)

		d := httpdriver.New(t, harness)
		defer d.Close()

		specifications.FSRSConcurrentExtensionIngests(t, d, d)
	})
}
