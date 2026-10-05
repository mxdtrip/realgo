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

// swagger:operation GET /api/v1/me/patterns get_api_v1_me_patterns
//
// ---
// tags:
// - Patterns
// summary: Получить паттерны со статистикой
// operationId: get_api_v1_me_patterns
// description: 'Ответ: data.patterns, а не data-массив. Параметр sort не обрабатывается этим handler.'
// security:
// - BearerAuth: []
// responses:
//   '200':
//     description: Успешный ответ
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       type: object
//       properties:
//         data:
//           $ref: '#/definitions/PatternsList'
//         meta:
//           $ref: '#/definitions/CommonMeta'
//       required:
//       - data
//   '401':
//     description: 'Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '500':
//     description: 'Внутренняя ошибка; коды: INTERNAL_ERROR'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '503':
//     description: 'Сервис или зависимость временно недоступны; коды: auth_unavailable'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '504':
//     description: Таймаут middleware (60 секунд); стандартная JSON-обёртка не гарантируется.
// produces:
// - application/json

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

// swagger:operation GET /api/v1/me/patterns/weak get_api_v1_me_patterns_weak
//
// ---
// tags:
// - Patterns
// summary: Получить слабые паттерны
// operationId: get_api_v1_me_patterns_weak
// description: Получить слабые паттерны.
// security:
// - BearerAuth: []
// parameters:
// - name: limit
//   in: query
//   required: false
//   description: По умолчанию 5. Значения выше 20 обрезаются до 20. Нечисловое или неположительное значение заменяется
//     значением по умолчанию.
//   type: integer
//   default: 5
// responses:
//   '200':
//     description: Успешный ответ
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       type: object
//       properties:
//         data:
//           type: array
//           items:
//             $ref: '#/definitions/PatternsWeakPattern'
//         meta:
//           $ref: '#/definitions/CommonMeta'
//       required:
//       - data
//   '401':
//     description: 'Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, unauthorized'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '500':
//     description: 'Внутренняя ошибка; коды: internal_error'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '503':
//     description: 'Сервис или зависимость временно недоступны; коды: auth_unavailable'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '504':
//     description: Таймаут middleware (60 секунд); стандартная JSON-обёртка не гарантируется.
// produces:
// - application/json

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

// swagger:operation GET /api/v1/me/patterns/{code} get_api_v1_me_patterns_code
//
// ---
// tags:
// - Patterns
// summary: Получить материал по паттерну
// operationId: get_api_v1_me_patterns_code
// description: Получить материал по паттерну.
// security:
// - BearerAuth: []
// parameters:
// - name: code
//   in: path
//   required: true
//   description: Код паттерна или субпаттерна.
//   type: string
//   minLength: 1
// responses:
//   '200':
//     description: Успешный ответ
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       type: object
//       properties:
//         data:
//           $ref: '#/definitions/PatternsPatternDetail'
//         meta:
//           $ref: '#/definitions/CommonMeta'
//       required:
//       - data
//   '401':
//     description: 'Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, unauthorized'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '404':
//     description: 'Сущность не найдена или недоступна; коды: not_found'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '500':
//     description: 'Внутренняя ошибка; коды: internal_error'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '503':
//     description: 'Сервис или зависимость временно недоступны; коды: auth_unavailable'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '504':
//     description: Таймаут middleware (60 секунд); стандартная JSON-обёртка не гарантируется.
// produces:
// - application/json

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
