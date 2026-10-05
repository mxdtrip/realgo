package problemcards

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type service interface {
	Get(ctx context.Context, userID, problemID int64) (Response, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts GET /{problemId}/cards on r (expected base: /me/problems,
// alongside problems.RegisterRoutes).
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/{problemId}/cards", h.Get)
}

// Get handles GET /api/v1/me/problems/{problemId}/cards.
//
// 200:
//
//	{"status": "ready" | "generating" | "none", "cards": [...]}
//
// cards has the same shape as GET /me/cards; empty unless status is "ready".
//
//   - ready      - the user has at least one accessible card for the problem
//     (their own cards, or global seed/AI cards).
//   - generating - no cards yet, but AI generation is in flight
//     (lock:gen:{platform}:{slug} held).
//   - none       - no cards and no generation in flight. Also covers a model
//     unknown_problem refusal and exhausted AI quota.
//
// 404 when problemId does not exist.
//
// Clients should poll every 2-3s until status is ready|none, capping at ~60s
// and treating a still-generating result past the cap as none.
// swagger:operation GET /api/v1/me/problems/{problemId}/cards get_api_v1_me_problems_problemId_cards
//
// ---
// tags:
// - Problems
// summary: Получить карточки и статус их генерации по задаче
// operationId: get_api_v1_me_problems_problemId_cards
// description: 'data.status: ready (карточки доступны), generating (генерация идёт), none (карточек и активной генерации
//   нет). Возвращает доступные пользователю глобальные и собственные карточки. Для глобальных AI-карточек требуется
//   прогресс пользователя по задаче со статусом solved или reviewing. Собственные и глобальные не-AI карточки проверяются
//   отдельно. Если карточки существуют, но не видны пользователю, ready не гарантируется.'
// security:
// - BearerAuth: []
// parameters:
// - name: problemId
//   in: path
//   required: true
//   description: Числовой ID, а не prb_*/card_* строка.
//   type: integer
//   format: int64
//   minimum: 1
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
//           $ref: '#/definitions/ProblemcardsResponse'
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

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	problemID, err := strconv.ParseInt(chi.URLParam(r, "problemId"), 10, 64)
	if err != nil || problemID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid problemId")
		return
	}

	result, err := h.svc.Get(r.Context(), userID, problemID)
	if errors.Is(err, ErrProblemNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "problem not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load problem cards")
		return
	}

	response.JSON(w, http.StatusOK, result)
}
