package extension

import (
	"context"
	"flag"
	"fmt"
	"math"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/mxdtrip/realgo/services/api/internal/scheduler"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/realgo/services/api/internal/testutil"
)

var testHarness *testutil.Harness

func TestMain(m *testing.M) {
	flag.Parse()

	if testing.Short() {
		os.Exit(m.Run())
	}

	h, err := testutil.Start(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "extension integration: failed to start harness:", err)
		os.Exit(1)
	}
	testHarness = h

	code := m.Run()
	testHarness.Stop()
	os.Exit(code)
}

// TestRepository_ConcurrentIngest_LostUpdate фиксирует контракт репозитория:
// параллельные вызовы Ingest для одной и той же задачи с разными eventId не должны
// приводить к потере обновлений (lost update) при продвижении расписания (Advance).
//
// Для обеспечения строгой детерминированности (по паттерну главы Sync из learn-go-with-tests)
// все конкурентные вызовы используют одинаковую оценку "hard", которая монотонно снижает
// стабильность FSRS на каждом шаге. Это исключает недетерминизм порядка планировщика ОС.
// При lost update расчёт от устаревшего снимка приведёт к завышенной стабильности (2.66 вместо 1.88)
// либо неполному review_count, что гарантированно вызовет падение теста.
func TestRepository_ConcurrentIngest_LostUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	testHarness.Reset(t)
	ctx := context.Background()

	// 1. Создаём тестового пользователя в базе
	email := fmt.Sprintf("ext-repo-race-%d@example.test", time.Now().UnixNano())
	var userID int64
	err := testHarness.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id`,
		email,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	sched := scheduler.NewFSRSAdapter()
	repo := NewRepository(testHarness.Pool, sched)

	platformID, err := repo.PlatformIDByCode(ctx, "leetcode")
	if err != nil {
		t.Fatalf("failed to resolve platform id: %v", err)
	}

	now := time.Now().UTC().Truncate(time.Second)
	const goroutines = 3

	// --- 2. Последовательный эталон (Sequential baseline) ---
	seqSlug := fmt.Sprintf("repo-race-seq-%d", time.Now().UnixNano())
	firstInSeq := IngestInput{
		UserID:         userID,
		PlatformID:     platformID,
		Slug:           seqSlug,
		Title:          "Two Sum Seq",
		URL:            "https://leetcode.com/problems/two-sum-seq/",
		Difficulty:     "easy",
		EventType:      EventProblemSolved,
		Rating:         "normal",
		EventTime:      now,
		IdempotencyKey: fmt.Sprintf("evt-seq-0-%s", seqSlug),
		Solved:         true,
	}
	outSeq, err := repo.Ingest(ctx, firstInSeq)
	if err != nil {
		t.Fatalf("failed to ingest initial seq solve: %v", err)
	}

	for i := 0; i < goroutines; i++ {
		in := IngestInput{
			UserID:         userID,
			PlatformID:     platformID,
			Slug:           seqSlug,
			Title:          "Two Sum Seq",
			URL:            "https://leetcode.com/problems/two-sum-seq/",
			Difficulty:     "easy",
			EventType:      EventProblemSolved,
			Rating:         "hard",
			EventTime:      now,
			IdempotencyKey: fmt.Sprintf("evt-seq-%d-%s", i+1, seqSlug),
			Solved:         true,
		}
		if _, err := repo.Ingest(ctx, in); err != nil {
			t.Fatalf("failed to ingest sequential solve %d: %v", i, err)
		}
	}

	q := db.New(testHarness.Pool)
	seqSched, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID:    userID,
		ProblemID: toInt8(outSeq.ProblemID),
	})
	if err != nil {
		t.Fatalf("failed to get seq schedule: %v", err)
	}
	seqStability := seqSched.Stability

	// --- 3. Конкурентный запуск (Concurrent ingests) ---
	concSlug := fmt.Sprintf("repo-race-conc-%d", time.Now().UnixNano())
	firstInConc := IngestInput{
		UserID:         userID,
		PlatformID:     platformID,
		Slug:           concSlug,
		Title:          "Two Sum Conc",
		URL:            "https://leetcode.com/problems/two-sum-conc/",
		Difficulty:     "easy",
		EventType:      EventProblemSolved,
		Rating:         "normal",
		EventTime:      now,
		IdempotencyKey: fmt.Sprintf("evt-conc-0-%s", concSlug),
		Solved:         true,
	}
	outConc, err := repo.Ingest(ctx, firstInConc)
	if err != nil {
		t.Fatalf("failed to ingest initial conc solve: %v", err)
	}

	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make(chan error, goroutines)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			in := IngestInput{
				UserID:         userID,
				PlatformID:     platformID,
				Slug:           concSlug,
				Title:          "Two Sum Conc",
				URL:            "https://leetcode.com/problems/two-sum-conc/",
				Difficulty:     "easy",
				EventType:      EventProblemSolved,
				Rating:         "hard",
				EventTime:      now,
				IdempotencyKey: fmt.Sprintf("evt-conc-%d-%s", idx+1, concSlug),
				Solved:         true,
			}
			_, err := repo.Ingest(ctx, in)
			if err != nil {
				errs <- fmt.Errorf("goroutine %d failed: %w", idx, err)
			}
		}(i)
	}

	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		t.Fatalf("concurrent ingest returned unexpected error: %v", err)
	}

	concSched, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID:    userID,
		ProblemID: toInt8(outConc.ProblemID),
	})
	if err != nil {
		t.Fatalf("failed to get conc schedule: %v", err)
	}

	// 1. Проверка счётчика
	if seqSched.ReviewCount.Int32 != concSched.ReviewCount.Int32 {
		t.Fatalf("concurrent ingests: expected review_count=%d, got %d", seqSched.ReviewCount.Int32,
			concSched.ReviewCount.Int32)
	}

	// 2. Проверка FSRS-стабильности
	if math.Abs(seqStability-concSched.Stability) > 0.05 {
		t.Fatalf("repository concurrent ingests: lost update detected! concurrent stability=%.2f differs from sequential stability=%.2f", concSched.Stability, seqStability)
	}
}

// TestRepository_ConcurrentInitialIngest_CreateConflict фиксирует контракт репозитория
// при одновременной регистрации первого решения новой задачи:
// два параллельных вызова Ingest для задачи, расписание которой ещё не существует в БД,
// не должны приводить к ошибкам уникальности или потере данных (ON CONFLICT DO NOTHING + retry).
// Итоговое расписание должно создаться и сразу продвинуться вторым вызовом (review_count = 2).
func TestRepository_ConcurrentInitialIngest_CreateConflict(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	testHarness.Reset(t)
	ctx := context.Background()

	email := fmt.Sprintf("ext-init-race-%d@example.test", time.Now().UnixNano())
	var userID int64
	err := testHarness.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id`,
		email,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	sched := scheduler.NewFSRSAdapter()
	repo := NewRepository(testHarness.Pool, sched)

	platformID, err := repo.PlatformIDByCode(ctx, "leetcode")
	if err != nil {
		t.Fatalf("failed to resolve platform id: %v", err)
	}

	now := time.Now().UTC().Truncate(time.Second)
	slug := fmt.Sprintf("repo-init-conc-%d", time.Now().UnixNano())

	const goroutines = 2
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make(chan error, goroutines)
	var outputs [goroutines]IngestOutput

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-start
			in := IngestInput{
				UserID:         userID,
				PlatformID:     platformID,
				Slug:           slug,
				Title:          "Two Sum Initial Conc",
				URL:            "https://leetcode.com/problems/two-sum-initial-conc/",
				Difficulty:     "easy",
				EventType:      EventProblemSolved,
				Rating:         "normal",
				EventTime:      now,
				IdempotencyKey: fmt.Sprintf("evt-init-%d-%s", idx, slug),
				Solved:         true,
			}
			out, err := repo.Ingest(ctx, in)
			if err != nil {
				errs <- fmt.Errorf("goroutine %d failed: %w", idx, err)
				return
			}
			outputs[idx] = out
		}(i)
	}

	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		t.Fatalf("concurrent initial ingest returned error: %v", err)
	}

	q := db.New(testHarness.Pool)
	schedRow, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID:    userID,
		ProblemID: toInt8(outputs[0].ProblemID),
	})
	if err != nil {
		t.Fatalf("failed to get review schedule for problem %d: %v", outputs[0].ProblemID, err)
	}

	if schedRow.ReviewCount.Int32 != 2 {
		t.Fatalf("expected review_count=2 after two concurrent initial ingests, got %d", schedRow.ReviewCount.Int32)
	}
}
