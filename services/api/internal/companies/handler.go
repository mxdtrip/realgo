package companies

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type searcher interface {
	Search(ctx context.Context, query string, limit int) ([]Company, error)
	List(ctx context.Context) ([]Company, error)
}

// swagger:operation GET /api/v1/companies get_api_v1_companies
//
// ---
// tags:
// - Companies
// summary: Получить список компаний
// operationId: get_api_v1_companies
// description: Получить список компаний.
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
//           type: array
//           items:
//             $ref: '#/definitions/CompaniesCompany'
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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	results, err := h.repo.List(r.Context())
	if err != nil {
		slog.Error("companies: List failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list companies")
		return
	}
	response.JSON(w, http.StatusOK, results)
}

type Handler struct {
	repo searcher
}

func NewHandler(repo searcher) *Handler {
	return &Handler{repo: repo}
}

// swagger:operation GET /api/v1/companies/search get_api_v1_companies_search
//
// ---
// tags:
// - Companies
// summary: Найти компании по названию и алиасам
// operationId: get_api_v1_companies_search
// description: Найти компании по названию и алиасам.
// security:
// - BearerAuth: []
// parameters:
// - name: query
//   in: query
//   required: false
//   description: Строка поиска; учитываются алиасы вроде facebook → Meta. Пустая строка допускается.
//   type: string
// - name: limit
//   in: query
//   required: false
//   description: 'По умолчанию 8, максимум выдачи 20. Значения ≤0 заменяются на 8, >20 обрезаются до 20. Нечисловое
//     значение: 400.'
//   type: integer
//   default: 8
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
//             $ref: '#/definitions/CompaniesCompany'
//         meta:
//           $ref: '#/definitions/CommonMeta'
//       required:
//       - data
//   '400':
//     description: 'Невалидный запрос; коды: VALIDATION_ERROR'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '401':
//     description: 'Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED'
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

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	limit := defaultSearchLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			slog.Warn("companies: Search failed", slog.Any("err", err), slog.String("limit", raw))
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "limit must be an integer")
			return
		}
		limit = parsed
	}

	results, err := h.repo.Search(r.Context(), r.URL.Query().Get("query"), limit)
	if err != nil {
		slog.Error("companies: Search failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not search companies")
		return
	}
	response.JSON(w, http.StatusOK, results)
}
