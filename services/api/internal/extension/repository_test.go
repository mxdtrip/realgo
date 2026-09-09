package extension

import (
	"context"
	"errors"
	"testing"
	"time"
)

// TestRetrySchedule проверяет алгоритмическую политику повторов независимой от БД:
//  1. Успех с первой попытки (Happy path);
//  2. Успешный выход после конфликта на первой попытке (Conflict retry);
//  3. Исчерпание попыток (все вызовы вернули errScheduleConflict) -> возврат ErrReviewConflict;
//  4. Фатальная ошибка (не конфликт) -> немедленный возврат без повторов;
//  5. Контекст отменён до вызова (pre-cancelled) -> мгновенный выход с context.Canceled без вызовов op;
//  6. Контекст отменён между повторами -> выход с context.Canceled после первой попытки без лишних ретраев.
func TestRetrySchedule(t *testing.T) {
	expectedTime := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	errDB := errors.New("unexpected database error")
	preCanceledCtx, preCancel := context.WithCancel(context.Background())
	preCancel()
	runtimeCanceledCtx, runtimeCancel := context.WithCancel(context.Background())

	tests := []struct {
		name      string
		attempts  int
		op        func(callCount *int) (int64, time.Time, error)
		wantID    int64
		wantTime  time.Time
		wantErr   error
		wantCalls int
		ctx       context.Context
	}{
		{
			name:     "happy path: успех с первой попытки",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				return 42, expectedTime, nil
			},
			wantID:    42,
			wantTime:  expectedTime,
			wantErr:   nil,
			wantCalls: 1,
		},
		{
			name:     "conflict retry: конфликт на 1-й попытке, успех на 2-й",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				if *callCount == 1 {
					return 0, time.Time{}, errScheduleConflict
				}
				return 42, expectedTime, nil
			},
			wantID:    42,
			wantTime:  expectedTime,
			wantErr:   nil,
			wantCalls: 2,
		},
		{
			name:     "exhausted: все попытки исчерпаны конфликтами -> ErrReviewConflict",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				return 0, time.Time{}, errScheduleConflict
			},
			wantID:    0,
			wantTime:  time.Time{},
			wantErr:   ErrReviewConflict,
			wantCalls: 3,
		},
		{
			name:     "fatal error: непредвиденная ошибка БД выходит без повторов",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				return 0, time.Time{}, errDB
			},
			wantID:    0,
			wantTime:  time.Time{},
			wantErr:   errDB,
			wantCalls: 1,
		},
		{
			name:     "context pre-cancelled: отмена до цикла завершает без вызовов op",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				return 0, time.Time{}, errScheduleConflict
			},
			wantID:    0,
			wantTime:  time.Time{},
			wantErr:   context.Canceled,
			wantCalls: 0,
			ctx:       preCanceledCtx,
		},
		{
			name:     "context cancelled during retry: отмена после конфликта предотвращает следующий шаг",
			attempts: 3,
			op: func(callCount *int) (int64, time.Time, error) {
				*callCount++
				runtimeCancel()
				return 0, time.Time{}, errScheduleConflict
			},
			wantID:    0,
			wantTime:  time.Time{},
			wantErr:   context.Canceled,
			wantCalls: 1,
			ctx:       runtimeCanceledCtx,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.ctx == nil {
				tt.ctx = context.Background()
			}
			calls := 0
			gotID, gotTime, gotErr := retrySchedule(tt.ctx, tt.attempts, func() (int64, time.Time, error) {
				return tt.op(&calls)
			})

			if calls != tt.wantCalls {
				t.Fatalf("retrySchedule() calls = %d, want %d", calls, tt.wantCalls)
			}
			if !errors.Is(gotErr, tt.wantErr) {
				t.Fatalf("retrySchedule() error = %v, want %v", gotErr, tt.wantErr)
			}
			if gotID != tt.wantID {
				t.Fatalf("retrySchedule() gotID = %d, want %d", gotID, tt.wantID)
			}
			if !gotTime.Equal(tt.wantTime) {
				t.Fatalf("retrySchedule() gotTime = %v, want %v", gotTime, tt.wantTime)
			}
		})
	}
}
