package practice

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type repository interface {
	List(ctx context.Context, userID int64) ([]Subpattern, error)
	Add(ctx context.Context, userID int64, code string) error
	Remove(ctx context.Context, userID int64, code string) error
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes mounts the practice routes on r (expected base: /me/practice).
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
	r.Post("/subpatterns", h.Add)
	r.Delete("/subpatterns/{code}", h.Remove)
}

// swagger:operation GET /api/v1/me/practice get_api_v1_me_practice
//
// ---
// tags:
// - Practice
// summary: Получить субпаттерны практики
// operationId: get_api_v1_me_practice
// description: Получить субпаттерны практики.
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
//           $ref: '#/definitions/PracticeList'
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
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("practice: List failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not list practice subpatterns")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"subpatterns": items})
}

// addRequest documents the PracticeAddRequest JSON shape.
//
// Example: {"code":"two_pointers"}
//
// swagger:model PracticeAddRequest
// swagger:additionalProperties false
type addRequest struct {
	// Код существующего субпаттерна, например two_pointers.
	//
	// Required: true
	// Min Length: 1
	Code string `json:"code"`
}

// swagger:operation POST /api/v1/me/practice/subpatterns post_api_v1_me_practice_subpatterns
//
// ---
// tags:
// - Practice
// summary: Добавить субпаттерн в практику
// operationId: post_api_v1_me_practice_subpatterns
// description: Добавить субпаттерн в практику.
// security:
// - BearerAuth: []
// consumes:
// - application/json
// parameters:
// - name: body
//   in: body
//   required: true
//   schema:
//     $ref: '#/definitions/PracticeAddRequest'
//   description: Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
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
//           $ref: '#/definitions/PracticeAdded'
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
//   '404':
//     description: 'Сущность не найдена или недоступна; коды: NOT_FOUND'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '413':
//     description: 'Превышен размер тела запроса; коды: REQUEST_TOO_LARGE'
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

func (h *Handler) Add(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req addRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
		return
	}

	if err := h.repo.Add(r.Context(), userID, code); err != nil {
		if errors.Is(err, ErrSubpatternNotFound) {
			slog.Warn("practice: Add failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "subpattern not found")
			return
		}
		slog.Error("practice: Add failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not add subpattern to practice")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"code": code, "active": true})
}

// swagger:operation DELETE /api/v1/me/practice/subpatterns/{code} delete_api_v1_me_practice_subpatterns_code
//
// ---
// tags:
// - Practice
// summary: Удалить субпаттерн из практики
// operationId: delete_api_v1_me_practice_subpatterns_code
// description: 'Успех: 204 без тела.'
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
//   '204':
//     description: Без тела ответа
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
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

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
		return
	}

	if err := h.repo.Remove(r.Context(), userID, code); err != nil {
		slog.Error("practice: Remove failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not remove subpattern from practice")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
