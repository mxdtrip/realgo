package quiz

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

const (
	defaultSessionLimit = 10
	maxSessionLimit     = 30
)

// service — consumer-side интерфейс handler'а. Обе рутин идут через него,
// сохраняя controller→service→repository (см. эталон internal/cards).
type service interface {
	ListSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error)
	RecordAnswer(ctx context.Context, userID, questionID int64, option int) (answerResult, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/session", h.session)
	r.Post("/{questionId}/answer", h.answer)
}

// GET /me/quiz/session
// swagger:operation GET /api/v1/me/quiz/session get_api_v1_me_quiz_session
//
// ---
// tags:
// - Quiz
// summary: Получить вопросы сессии квиза
// operationId: get_api_v1_me_quiz_session
// description: Получить вопросы сессии квиза.
// security:
// - BearerAuth: []
// parameters:
// - name: limit
//   in: query
//   required: false
//   description: По умолчанию 10. Значения выше 30 обрезаются до 30. Нечисловое или неположительное значение заменяется
//     значением по умолчанию.
//   type: integer
//   default: 10
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
//           $ref: '#/definitions/QuizSession'
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

func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("quiz: session failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	rows, err := h.svc.ListSession(r.Context(), userID, sessionLimit(r))
	if err != nil {
		slog.Error("quiz: session failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load quiz session")
		return
	}

	items := make([]questionItem, 0, len(rows))
	for _, q := range rows {
		items = append(items, questionItemFromSessionQuestion(q))
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"questions": items,
		"total":     len(items),
	})
}

// POST /me/quiz/{questionId}/answer
// swagger:operation POST /api/v1/me/quiz/{questionId}/answer post_api_v1_me_quiz_questionId_answer
//
// ---
// tags:
// - Quiz
// summary: Ответить на вопрос квиза
// operationId: post_api_v1_me_quiz_questionId_answer
// description: option — индекс в options с нуля. Повторный ответ на этот вопрос возвращает 409 CONFLICT. Запрос {}
//   трактуется как option=0.
// security:
// - BearerAuth: []
// consumes:
// - application/json
// parameters:
// - name: questionId
//   in: path
//   required: true
//   description: Числовой ID, а не prb_*/card_* строка.
//   type: integer
//   format: int64
// - name: body
//   in: body
//   required: true
//   schema:
//     $ref: '#/definitions/QuizAnswerRequest'
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
//           $ref: '#/definitions/QuizAnswerResult'
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
//   '409':
//     description: 'Конфликт состояния; коды: CONFLICT'
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

func (h *Handler) answer(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("quiz: answer failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	questionID, err := strconv.ParseInt(chi.URLParam(r, "questionId"), 10, 64)
	if err != nil {
		slog.Warn("quiz: answer failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid questionId")
		return
	}

	var req answerRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}

	res, err := h.svc.RecordAnswer(r.Context(), userID, questionID, req.Option)
	if err != nil {
		switch {
		case errors.Is(err, ErrQuestionNotFound):
			slog.Warn("quiz: answer failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("question_id", questionID))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "question not found")
		case errors.Is(err, ErrAlreadyAnswered):
			slog.Warn("quiz: answer rejected (already answered)", slog.Int64("user_id", userID), slog.Int64("question_id", questionID))
			response.Fail(w, http.StatusConflict, "CONFLICT", "question already answered")
		case errors.Is(err, ErrInvalidOption):
			slog.Warn("quiz: answer rejected (invalid option)", slog.Int64("user_id", userID), slog.Int64("question_id", questionID), slog.Int("option", req.Option))
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "option is out of range")
		default:
			slog.Error("quiz: answer failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("question_id", questionID))
			response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not record answer")
		}
		return
	}

	response.JSON(w, http.StatusOK, res)
}

func sessionLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultSessionLimit
	}
	if limit > maxSessionLimit {
		return maxSessionLimit
	}
	return int32(limit)
}
