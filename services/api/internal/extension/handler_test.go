package extension

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/stretchr/testify/require"
)

type fakeEventService struct {
	err error
}

func (es *fakeEventService) Handle(ctx context.Context, userID int64, req EventRequest) (EventResult, error) {
	return EventResult{}, es.err
}

// TestPostEvent_ErrorMapping проверяет контракт маппинга доменных ошибок в HTTP-статусы:
//   - ErrReviewConflict -> 409 Conflict (код REVIEW_CONFLICT);
//   - ErrValidation -> 400 Bad Request (код VALIDATION_ERROR);
//   - ErrUnknownPlatform -> 422 Unprocessable Entity (код UNKNOWN_PLATFORM);
//   - любая непредвиденная ошибка -> 500 Internal Server Error (код INTERNAL_ERROR).
func TestPostEvent_ErrorMapping(t *testing.T) {
	tests := []struct {
		name       string
		svcErr     error
		wantStatus int
		wantCode   string
	}{
		{
			name:       "review conflict -> 409 REVIEW_CONFLICT",
			svcErr:     ErrReviewConflict,
			wantStatus: http.StatusConflict,
			wantCode:   "REVIEW_CONFLICT",
		},
		{
			name:       "validation error -> 400 VALIDATION_ERROR",
			svcErr:     ErrValidation,
			wantStatus: http.StatusBadRequest,
			wantCode:   "VALIDATION_ERROR",
		},
		{
			name:       "unknown platform -> 422 UNKNOWN_PLATFORM",
			svcErr:     ErrUnknownPlatform,
			wantStatus: http.StatusUnprocessableEntity,
			wantCode:   "UNKNOWN_PLATFORM",
		},
		{
			name:       "unexpected error -> 500 INTERNAL_ERROR",
			svcErr:     errors.New("db failure"),
			wantStatus: http.StatusInternalServerError,
			wantCode:   "INTERNAL_ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeSvc := &fakeEventService{tt.svcErr}
			h := NewHandler(fakeSvc)

			raw, err := json.Marshal(map[string]any{
				"source": "leetcode", "event": "problem_solved",
			})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/extension/events", bytes.NewReader(raw))
			req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
			rec := httptest.NewRecorder()
			h.PostEvent(rec, req)

			require.Equal(t, tt.wantStatus, rec.Code, "не совпал HTTP статус-код")
			var body struct {
				Error struct{ Code string } `json:"error"`
			}
			err = json.NewDecoder(rec.Body).Decode(&body)
			require.NoError(t, err, "не удалось декодировать JSON ответа")
			require.Equal(t, tt.wantCode, body.Error.Code, "не совпал код ошибки в теле ответа")
		})
	}
}
