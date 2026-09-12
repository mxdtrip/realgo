package extension

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/realgo/services/api/internal/scheduler"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

// algorithmFSRS marks every schedule written by the extension ingest as
// FSRS-owned, matching the review-service path.
const algorithmFSRS = "fsrs"

// IngestInput carries one already-validated event into the storage transaction.
// The scheduler Decision (FSRS fields, interval) is computed inside the
// repository at upsert time so it can read prior state atomically.
type IngestInput struct {
	UserID           int64
	PlatformID       int64
	Slug             string
	Title            string
	URL              string
	Difficulty       string
	EventType        string
	Rating           string
	ExtensionVersion string
	EventTime        time.Time
	IdempotencyKey   string
	RawPayload       []byte

	Solved bool
}

// IngestOutput is the result of persisting one event.
type IngestOutput struct {
	ProblemID    int64
	ReviewID     int64
	Duplicate    bool
	Status       string
	NextReviewAt *time.Time
}

// Repository persists extension events and the problem/progress/schedule they
// produce.
type Repository interface {
	PlatformIDByCode(ctx context.Context, code string) (int64, error)
	Ingest(ctx context.Context, in IngestInput) (IngestOutput, error)
}

type pgRepository struct {
	pool  *pgxpool.Pool
	q     *db.Queries
	sched scheduler.Scheduler
}

// NewRepository builds a Postgres-backed Repository. The scheduler is used
// inside upsertSchedule to compute the next-review decision with prior FSRS
// state, so that extension and review paths share one algorithm (issue #160).
func NewRepository(pool *pgxpool.Pool, sched scheduler.Scheduler) *pgRepository {
	return &pgRepository{pool: pool, q: db.New(pool), sched: sched}
}

func (r *pgRepository) PlatformIDByCode(ctx context.Context, code string) (int64, error) {
	platform, err := r.q.GetPlatformByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownPlatform
	}
	if err != nil {
		return 0, fmt.Errorf("extension: lookup platform: %w", err)
	}
	return platform.ID, nil
}

// Ingest выполняет сохранение события расширения в рамках единой транзакции:
// 1. Идемпотентно регистрирует задачу и факт события (recordProblemAndEvent).
// 2. Для дубликатов определяет статус через resolveDuplicateSchedule:
//   - при найденном расписании возвращает статус без повторного продвижения;
//   - при отсутствии расписания (self-heal) восстанавливает состояние решённой задачи.
//
// 3. Для новых решённых событий обновляет прогресс и расписание (saveSolvedState).
// 4. Фиксирует транзакцию в единственной точке коммита.
func (r *pgRepository) Ingest(ctx context.Context, in IngestInput) (out IngestOutput, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return IngestOutput{}, fmt.Errorf("extension: begin tx: %w", err)
	}
	defer func() {
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil && !errors.Is(rollbackErr, pgx.ErrTxClosed) {
			err = errors.Join(err, fmt.Errorf("extension: rollback tx: %w", rollbackErr))
		}
	}()

	q := r.q.WithTx(tx)

	problemID, duplicate, err := r.recordProblemAndEvent(ctx, q, in)
	if err != nil {
		return IngestOutput{}, err
	}
	out = IngestOutput{ProblemID: problemID, Duplicate: duplicate}

	needsSaveSolved := in.Solved && !duplicate
	if duplicate {
		sched, e := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
			UserID: in.UserID, ProblemID: toInt8(problemID),
		})
		res, rerr := resolveDuplicateSchedule(sched, e, in.Solved)
		if rerr != nil {
			return IngestOutput{}, rerr
		}
		if res.needsHealing {
			needsSaveSolved = true
		} else {
			out.Status = res.status
			out.ReviewID = res.reviewID
			out.NextReviewAt = res.nextReviewAt
		}
	}

	if needsSaveSolved {
		reviewID, nextReviewAt, serr := r.saveSolvedState(ctx, q, in, problemID)
		if serr != nil {
			return IngestOutput{}, serr
		}
		out.Status = "reviewing"
		out.ReviewID = reviewID
		out.NextReviewAt = &nextReviewAt
	} else if !duplicate {
		out.Status = "saved"
	}

	if err := tx.Commit(ctx); err != nil {
		return IngestOutput{}, fmt.Errorf("extension: commit tx: %w", err)
	}
	return out, nil
}

const maxScheduleAttempts = 3

// errScheduleConflict — внутренняя sentinel-ошибка, сигнализирующая о конфликте версий
// или гонке DO NOTHING при выполнении одного шага создания/обновления расписания.
var errScheduleConflict = errors.New("extension: schedule conflict on step")

// retrySchedule реализует политику повторов с учётом контекста: перед каждой попыткой
// проверяет ctx.Err(). Выполняет операцию op до maxAttempts раз, повторяя попытку
// при получении errScheduleConflict. При исчерпании лимита возвращает ErrReviewConflict.
// При отмене контекста или любой другой ошибке завершается немедленно без ретрая.
func retrySchedule(ctx context.Context, maxAttempts int, op func() (int64, time.Time, error)) (int64, time.Time, error) {
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if ctx.Err() != nil {
			return 0, time.Time{}, ctx.Err()
		}
		id, next, err := op()
		if errors.Is(err, errScheduleConflict) {
			continue
		}
		if err != nil {
			return 0, time.Time{}, err
		}
		return id, next, nil
	}
	return 0, time.Time{}, ErrReviewConflict
}

// createInitialSchedule создаёт расписание для первого решения задачи без prior-state.
// Параметры запроса формируются через чистый маппер toCreateScheduleParams.
// При параллельной гонке создания (DO NOTHING вернул ErrNoRows) возвращает
// внутреннюю ошибку errScheduleConflict для повторной попытки.
func (r *pgRepository) createInitialSchedule(ctx context.Context, q *db.Queries, in IngestInput, problemID int64) (int64, time.Time, error) {
	decision, err := r.sched.Next(scheduler.Rating(in.Rating), in.EventTime)
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: schedule decision: %w", err)
	}
	row, err := q.CreateProblemReviewSchedule(ctx, toCreateScheduleParams(in, problemID, decision))
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, time.Time{}, errScheduleConflict
	}
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: create schedule: %w", err)
	}
	return row.ID, row.NextReviewAt.Time, nil
}

// advanceExistingSchedule продвигает существующее расписание FSRS для повторного решения задачи.
// Преобразование состояния и параметров запроса делегировано чистым мапперам toPriorState и toAdvanceScheduleParams.
// Если параллельная транзакция успела обновить review_count раньше нас (несовпадение expected_review_count
// вернуло ErrNoRows), возвращает внутреннюю ошибку errScheduleConflict для повторной попытки.
func (r *pgRepository) advanceExistingSchedule(ctx context.Context, q *db.Queries, in IngestInput, existing db.GetProblemReviewScheduleRow) (int64, time.Time, error) {
	prior := toPriorState(existing)
	decision, err := r.sched.NextWithState(prior, scheduler.Rating(in.Rating), in.EventTime)
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: schedule decision: %w", err)
	}
	row, err := q.AdvanceProblemReviewSchedule(ctx, toAdvanceScheduleParams(existing, in, decision))
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, time.Time{}, errScheduleConflict
	}
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: advance schedule: %w", err)
	}
	return row.ID, row.NextReviewAt.Time, nil
}

// executeScheduleStep выполняет одну попытку расчёта и сохранения расписания:
// проверяет существование записи и направляет вызов в createInitialSchedule либо advanceExistingSchedule.
func (r *pgRepository) executeScheduleStep(ctx context.Context, q *db.Queries, in IngestInput, problemID int64) (int64, time.Time, error) {
	existing, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID: in.UserID, ProblemID: toInt8(problemID),
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return r.createInitialSchedule(ctx, q, in, problemID)
	case err != nil:
		return 0, time.Time{}, fmt.Errorf("extension: lookup schedule: %w", err)
	default:
		return r.advanceExistingSchedule(ctx, q, in, existing)
	}
}

// recordProblemAndEvent регистрирует задачу в каталоге и сохраняет входящее событие расширения.
// Возвращает ID задачи, признак дубликата (если событие с данным idempotency_key уже зафиксировано)
// и ошибку при сбое записи в БД.
func (r *pgRepository) recordProblemAndEvent(ctx context.Context, q *db.Queries, in IngestInput) (int64, bool, error) {
	problemID, err := q.UpsertExtensionProblem(ctx, db.UpsertExtensionProblemParams{
		PlatformID:      in.PlatformID,
		ExternalSlug:    in.Slug,
		Title:           in.Title,
		Url:             in.URL,
		Difficulty:      optText(in.Difficulty),
		CreatedByUserID: toInt8(in.UserID),
	})
	if err != nil {
		return 0, false, fmt.Errorf("extension: upsert problem: %w", err)
	}

	_, err = q.InsertExtensionEvent(ctx, db.InsertExtensionEventParams{
		UserID:           toInt8(in.UserID),
		PlatformID:       in.PlatformID,
		Url:              in.URL,
		ExternalSlug:     optText(in.Slug),
		Title:            optText(in.Title),
		EventType:        in.EventType,
		Rating:           optText(in.Rating),
		ExtensionVersion: optText(in.ExtensionVersion),
		EventTime:        toTimestamptz(in.EventTime),
		IdempotencyKey:   optText(in.IdempotencyKey),
		RawPayload:       in.RawPayload,
	})
	duplicate := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !duplicate {
		return 0, false, fmt.Errorf("extension: insert event: %w", err)
	}
	return problemID, duplicate, nil
}

// saveSolvedState сохраняет прогресс решения задачи, рассчитывает/обновляет FSRS-расписание
// и фиксирует запись попытки в review_attempts.
// Метод переиспользуется как при штатном решении задачи, так и в ветке self-healing.
func (r *pgRepository) saveSolvedState(ctx context.Context, q *db.Queries, in IngestInput, problemID int64) (int64, time.Time, error) {
	err := q.UpsertSolvedProgress(ctx, db.UpsertSolvedProgressParams{
		UserID:      in.UserID,
		ProblemID:   problemID,
		Rating:      optText(in.Rating),
		FirstSeenAt: toTimestamptz(in.EventTime),
	})
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: upsert progress: %w", err)
	}
	reviewID, nextReviewAt, err := r.upsertSchedule(ctx, q, in, problemID)
	if err != nil {
		return 0, time.Time{}, err
	}
	_, err = q.CreateReviewAttempt(ctx, db.CreateReviewAttemptParams{
		UserID:      in.UserID,
		ProblemID:   toInt8(problemID),
		PatternID:   pgtype.Int8{},
		CardID:      pgtype.Int8{},
		Rating:      in.Rating,
		ReviewType:  "problem",
		DurationSec: pgtype.Int4{},
		WasCorrect:  pgtype.Bool{},
	})
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("extension: create review attempt: %w", err)
	}
	return reviewID, nextReviewAt, nil
}

// upsertSchedule создаёт расписание задачи при первом решении либо продвигает
// существующее с помощью планировщика FSRS. Координация повторов при конфликтах
// версий и гонках DO NOTHING делегирована функции retrySchedule.
func (r *pgRepository) upsertSchedule(ctx context.Context, q *db.Queries, in IngestInput, problemID int64) (int64, time.Time, error) {
	return retrySchedule(ctx, maxScheduleAttempts, func() (int64, time.Time, error) {
		return r.executeScheduleStep(ctx, q, in, problemID)
	})
}

// --- pgtype helpers ---------------------------------------------------------

func optText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func toInt8(v int64) pgtype.Int8 {
	return pgtype.Int8{Int64: v, Valid: true}
}

func toTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func timePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

// safeInt32 безопасно приводит int к int32 с ограничением диапазоном [math.MinInt32, math.MaxInt32].
// Предотвращает целочисленное переполнение (CWE-190, gosec G115) при передаче счётчиков FSRS в sqlc.
func safeInt32(v int) int32 {
	if v > math.MaxInt32 {
		return math.MaxInt32
	}
	if v < math.MinInt32 {
		return math.MinInt32
	}
	return int32(v)
}

// safeInt8 безопасно приводит int16 к int8 с ограничением диапазоном [math.MinInt8, math.MaxInt8].
// Предотвращает целочисленное переполнение (CWE-190, gosec G115) при передаче состояния FSRS из БД.
func safeInt8(v int16) int8 {
	if v > math.MaxInt8 {
		return math.MaxInt8
	}
	if v < math.MinInt8 {
		return math.MinInt8
	}
	return int8(v)
}

// toPriorState преобразует строку расписания из базы данных db.GetProblemReviewScheduleRow
// в доменное состояние scheduler.SchedulerState для расчёта FSRS. Чистая функция без побочных эффектов.
func toPriorState(existing db.GetProblemReviewScheduleRow) scheduler.SchedulerState {
	return scheduler.SchedulerState{
		Stability:     existing.Stability,
		Difficulty:    existing.Difficulty,
		Ease:          existing.Ease,
		State:         safeInt8(existing.State),
		ScheduledDays: uint64(math.Max(0, math.Round(existing.IntervalDays))),
		Reps:          uint64(max(0, existing.ReviewCount.Int32)),
		Lapses:        uint64(max(0, existing.Lapses)),
		LastReview:    existing.LastReviewAt.Time,
		Due:           existing.NextReviewAt.Time,
	}
}

// toCreateScheduleParams формирует параметры db.CreateProblemReviewScheduleParams для вставки
// первичного расписания задачи. Чистая функция без побочных эффектов.
func toCreateScheduleParams(in IngestInput, problemID int64, decision scheduler.Decision) db.CreateProblemReviewScheduleParams {
	return db.CreateProblemReviewScheduleParams{
		UserID:         in.UserID,
		ProblemID:      toInt8(problemID),
		NextReviewAt:   toTimestamptz(decision.NextReviewAt),
		IntervalDays:   decision.IntervalDays,
		Ease:           decision.Ease,
		Stability:      decision.Stability,
		Difficulty:     decision.Difficulty,
		State:          int16(decision.State),
		Lapses:         safeInt32(decision.Lapses),
		RemainingSteps: safeInt32(decision.RemainingSteps),
		LastReviewAt:   toTimestamptz(in.EventTime),
		LastRating:     optText(in.Rating),
		Algorithm:      optText(algorithmFSRS),
	}
}

// toAdvanceScheduleParams формирует параметры db.AdvanceProblemReviewScheduleParams для обновления
// расписания FSRS с оптимистическим контролем версии (ExpectedReviewCount). Чистая функция без побочных эффектов.
func toAdvanceScheduleParams(existing db.GetProblemReviewScheduleRow, in IngestInput, decision scheduler.Decision) db.AdvanceProblemReviewScheduleParams {
	return db.AdvanceProblemReviewScheduleParams{
		ID:                  existing.ID,
		NextReviewAt:        toTimestamptz(decision.NextReviewAt),
		IntervalDays:        decision.IntervalDays,
		Stability:           decision.Stability,
		Difficulty:          decision.Difficulty,
		State:               int16(decision.State),
		Lapses:              safeInt32(decision.Lapses),
		RemainingSteps:      safeInt32(decision.RemainingSteps),
		LastReviewAt:        toTimestamptz(in.EventTime),
		LastRating:          optText(in.Rating),
		ExpectedReviewCount: existing.ReviewCount.Int32,
	}
}

// duplicateResolution инкапсулирует результат анализа существующего расписания при дубликате события.
type duplicateResolution struct {
	status       string
	reviewID     int64
	nextReviewAt *time.Time
	needsHealing bool
}

// resolveDuplicateSchedule анализирует результат поиска расписания при повторном событии:
//   - если расписание существует (err == nil): возвращает статус "reviewing" и параметры расписания;
//   - если расписание отсутствует (pgx.ErrNoRows): для решённой задачи выставляет needsHealing=true,
//     а для нерешённой — статус "saved";
//   - при любой другой ошибке БД возвращает ошибку. Чистая функция без побочных эффектов.
func resolveDuplicateSchedule(sched db.GetProblemReviewScheduleRow, err error, solved bool) (duplicateResolution, error) {
	switch {
	case err == nil:
		return duplicateResolution{
			status:       "reviewing",
			reviewID:     sched.ID,
			nextReviewAt: timePtr(sched.NextReviewAt),
		}, nil
	case errors.Is(err, pgx.ErrNoRows):
		if solved {
			return duplicateResolution{
				needsHealing: true,
			}, nil
		}
		return duplicateResolution{status: "saved"}, nil
	default:
		return duplicateResolution{}, fmt.Errorf("extension: lookup review schedule failed: %w", err)

	}
}
