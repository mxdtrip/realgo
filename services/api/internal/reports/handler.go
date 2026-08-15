package reports

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type repository interface {
	Create(ctx context.Context, userID int64, input CreateInput) (string, time.Time, error)
}

type Handler struct{ repo repository }

func NewHandler(repo repository) *Handler { return &Handler{repo: repo} }

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req Request
	if !httpjson.DecodeStrictLimit(w, r, &req, "VALIDATION_ERROR", MaxRequestBodyBytes) {
		return
	}
	input, err := Normalize(req, middleware.GetReqID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrValidation) {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		slog.Error("reports: normalize failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not prepare problem report")
		return
	}

	reportID, createdAt, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		slog.Error("reports: create failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not save problem report")
		return
	}

	response.JSON(w, http.StatusCreated, Result{
		ReportID: reportID, Fingerprint: input.Fingerprint, ReceivedAt: createdAt.Format(time.RFC3339Nano),
	})
}
