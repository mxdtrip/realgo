package extension

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// eventService is the behaviour the handler needs; satisfied by *Service.
type eventService interface {
	Handle(ctx context.Context, userID int64, req EventRequest) (EventResult, error)
}

// Handler serves the browser-extension ingest endpoint.
type Handler struct {
	svc eventService
}

// NewHandler builds the extension HTTP handler.
func NewHandler(svc eventService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the extension routes on r (expected base: /extension).
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/events", h.PostEvent)
}

// PostEvent обрабатывает входящее событие решения задачи от браузерного расширения: POST /api/v1/extension/events.
// Контракт маппинга ошибок:
//   - 401 Unauthorized: пользователь не аутентифицирован (отсутствует userID в контексте);
//   - 400 Bad Request: ошибка валидации тела запроса или ErrValidation (код VALIDATION_ERROR);
//   - 409 Conflict: конфликт версий повторения ErrReviewConflict при исчерпании ретраев (код REVIEW_CONFLICT, уровень Warn);
//   - 422 Unprocessable Entity: неизвестная платформа ErrUnknownPlatform (код UNKNOWN_PLATFORM);
//   - 500 Internal Server Error: непредвиденная ошибка (код INTERNAL_ERROR, уровень Error).
func (h *Handler) PostEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("extension: PostEvent failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req EventRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}

	result, err := h.svc.Handle(r.Context(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			slog.Warn("extension: PostEvent failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		case errors.Is(err, ErrUnknownPlatform):
			slog.Warn("extension: PostEvent failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusUnprocessableEntity, "UNKNOWN_PLATFORM", err.Error())
		case errors.Is(err, ErrReviewConflict):
			slog.Warn("extension: PostEvent conflict", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusConflict, "REVIEW_CONFLICT", err.Error())
		default:
			slog.Error("extension: PostEvent failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not save extension event")
		}
		return
	}

	response.JSON(w, http.StatusOK, result)
}
