package patterns

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

const (
	// Five items are enough for the dashboard preview without turning the MVP
	// endpoint into a full analytics report.
	defaultWeakPatternsLimit = 5
	// Keep the ad-hoc limit bounded until this endpoint has pagination.
	maxWeakPatternsLimit = 20
)

type Handler struct {
	repo repository
}

type repository interface {
	List(ctx context.Context, userID int64) ([]Pattern, error)
	ListWeak(ctx context.Context, userID int64, limit int32) ([]WeakPattern, error)
	GetByCode(ctx context.Context, code string) (PatternDetail, error)
	GetAtlas(ctx context.Context, userID int64, companyCode string) (AtlasResponse, error)
	ListCompanies(ctx context.Context) ([]AtlasCompany, error)
	GetAtlasNode(ctx context.Context, userID int64, code, platformCode string) (NodeDetail, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
	r.Get("/weak", h.ListWeak)
	// Pattern Atlas: static segments win over the /{code} param in chi.
	r.Get("/atlas", h.GetAtlas)
	r.Get("/atlas/companies", h.ListAtlasCompanies)
	r.Get("/atlas/{code}", h.GetAtlasNode)
	r.Get("/{code}", h.GetDetail)
}

// swagger:operation GET /api/v1/me/patterns Patterns get_api_v1_me_patterns
//
// ---
// summary: "Получить паттерны со статистикой"
// description: "Ответ: data.patterns, а не data-массив. Параметр sort не обрабатывается этим handler."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/patternList"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: List failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
		return
	}

	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("patterns: List failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not list patterns")
		return
	}

	response.JSON(w, http.StatusOK, map[string][]Pattern{"patterns": items})
}

// swagger:operation GET /api/v1/me/patterns/weak Patterns get_api_v1_me_patterns_weak
//
// ---
// summary: "Получить слабые паттерны"
// description: "Получить слабые паттерны."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/weakPatterns"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) ListWeak(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: ListWeak failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	items, err := h.repo.ListWeak(r.Context(), userID, weakPatternsLimit(r))
	if err != nil {
		slog.Error("patterns: ListWeak failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list weak patterns")
		return
	}

	response.JSON(w, http.StatusOK, items)
}

// swagger:operation GET /api/v1/me/patterns/{code} Patterns get_api_v1_me_patterns_code
//
// ---
// summary: "Получить материал по паттерну"
// description: "Получить материал по паттерну."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/patternDetail"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) GetDetail(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		slog.Warn("patterns: GetDetail failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	code := chi.URLParam(r, "code")

	detail, err := h.repo.GetByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, ErrPatternNotFound) {
			slog.Warn("patterns: GetDetail failed", slog.Any("err", err), slog.String("code", code))
			response.Fail(w, http.StatusNotFound, "not_found", "pattern not found")
			return
		}
		slog.Error("patterns: GetDetail failed", slog.Any("err", err), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load pattern")
		return
	}

	response.JSON(w, http.StatusOK, detail)
}

func weakPatternsLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultWeakPatternsLimit
	}
	if limit > maxWeakPatternsLimit {
		return maxWeakPatternsLimit
	}
	return int32(limit)
}
