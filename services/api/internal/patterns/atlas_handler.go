package patterns

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

var ErrCompanyNotFound = errors.New("company not found")

// GetAtlas serves GET /me/patterns/atlas[?company=<code>].
// swagger:operation GET /api/v1/me/patterns/atlas get_api_v1_me_patterns_atlas
//
// ---
// tags:
// - Patterns
// summary: Получить Pattern Atlas с company overlay
// operationId: get_api_v1_me_patterns_atlas
// description: Получить Pattern Atlas с company overlay. В проверенном коммите после Bearer-авторизации нет проверки
//   тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована.
// security:
// - BearerAuth: []
// parameters:
// - name: company
//   in: query
//   required: false
//   description: Необязательный код компании. Если у компании нет relevance data, возвращается 404.
//   type: string
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
//           $ref: '#/definitions/PatternsAtlasResponse'
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

func (h *Handler) GetAtlas(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: GetAtlas failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	companyCode := r.URL.Query().Get("company")
	atlas, err := h.repo.GetAtlas(r.Context(), userID, companyCode)
	if err != nil {
		if errors.Is(err, ErrCompanyNotFound) {
			slog.Warn("patterns: GetAtlas failed", slog.Any("err", err), slog.String("company", companyCode))
			response.Fail(w, http.StatusNotFound, "not_found", "company has no relevance data")
			return
		}
		slog.Error("patterns: GetAtlas failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load pattern atlas")
		return
	}

	response.JSON(w, http.StatusOK, atlas)
}

// ListAtlasCompanies serves GET /me/patterns/atlas/companies: companies that
// actually carry relevance evidence (never an invented list).
// swagger:operation GET /api/v1/me/patterns/atlas/companies get_api_v1_me_patterns_atlas_companies
//
// ---
// tags:
// - Patterns
// summary: Получить компании с evidence в атласе
// operationId: get_api_v1_me_patterns_atlas_companies
// description: Получить компании с evidence в атласе. В проверенном коммите после Bearer-авторизации нет проверки
//   тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована.
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
//           $ref: '#/definitions/AtlasCompanies'
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

func (h *Handler) ListAtlasCompanies(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		slog.Warn("patterns: ListAtlasCompanies failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	companies, err := h.repo.ListCompanies(r.Context())
	if err != nil {
		slog.Error("patterns: ListAtlasCompanies failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list companies")
		return
	}

	response.JSON(w, http.StatusOK, map[string][]AtlasCompany{"companies": companies})
}

// GetAtlasNode serves GET /me/patterns/atlas/{code}: the educational detail
// view of a taxonomy node (family or subpattern).
// swagger:operation GET /api/v1/me/patterns/atlas/{code} get_api_v1_me_patterns_atlas_code
//
// ---
// tags:
// - Patterns
// summary: Получить семейство или субпаттерн атласа
// operationId: get_api_v1_me_patterns_atlas_code
// description: Получить семейство или субпаттерн атласа.
// security:
// - BearerAuth: []
// parameters:
// - name: code
//   in: path
//   required: true
//   description: Код паттерна или субпаттерна.
//   type: string
//   minLength: 1
// - name: platform
//   in: query
//   required: false
//   description: Необязательный фильтр платформы для practice-секции. Например hackerrank.
//   type: string
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
//           $ref: '#/definitions/PatternsNodeDetail'
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

func (h *Handler) GetAtlasNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: GetAtlasNode failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	code := chi.URLParam(r, "code")
	platformCode := r.URL.Query().Get("platform")
	detail, err := h.repo.GetAtlasNode(r.Context(), userID, code, platformCode)
	if err != nil {
		if errors.Is(err, ErrPatternNotFound) {
			slog.Warn("patterns: GetAtlasNode failed", slog.Any("err", err), slog.String("code", code))
			response.Fail(w, http.StatusNotFound, "not_found", "pattern not found")
			return
		}
		slog.Error("patterns: GetAtlasNode failed", slog.Any("err", err), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load pattern")
		return
	}

	response.JSON(w, http.StatusOK, detail)
}
