package extension

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

const (
	defaultRecentEventsLimit = 10
	maxRecentEventsLimit     = 50
)

type extensionStatusService interface {
	Get(ctx context.Context, userID int64, limit int32) (StatusResponse, error)
}

// StatusHandler serves extension status endpoints.
type StatusHandler struct {
	svc extensionStatusService
}

// NewStatusHandler builds the extension status HTTP handler.
func NewStatusHandler(svc extensionStatusService) *StatusHandler {
	return &StatusHandler{svc: svc}
}

// GetStatus: GET /api/v1/me/extension/status
// swagger:operation GET /api/v1/me/extension/status Extension get_api_v1_me_extension_status
//
// ---
// summary: "Получить состояние синхронизации расширения"
// description: "Получить состояние синхронизации расширения."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/extensionStatus"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *StatusHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("extension: GetStatus failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	status, err := h.svc.Get(r.Context(), userID, recentEventsLimit(r))
	if err != nil {
		slog.Error("extension: GetStatus failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load extension status")
		return
	}

	response.JSON(w, http.StatusOK, status)
}

func recentEventsLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultRecentEventsLimit
	}
	if limit > maxRecentEventsLimit {
		return maxRecentEventsLimit
	}
	return int32(limit)
}
