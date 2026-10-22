package dashboard

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type Handler struct {
	svc service
}

type service interface {
	Get(ctx context.Context, userID int64) (Response, error)
}

func NewHandler(svc service) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/me/dashboard", h.Get)
}

// swagger:operation GET /api/v1/me/dashboard Dashboard get_api_v1_me_dashboard
//
// ---
// summary: "Получить данные главной страницы кабинета"
// description: "Получить данные главной страницы кабинета."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/dashboard"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("dashboard: Get failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	data, err := h.svc.Get(r.Context(), userID)
	if err != nil {
		slog.Error("dashboard: Get failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load dashboard")
		return
	}
	response.JSON(w, http.StatusOK, data)
}
