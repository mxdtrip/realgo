package v1

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/controller/v1/request"
	v1response "github.com/mxdtrip/realgo/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/realgo/services/api/internal/entity"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
	"github.com/mxdtrip/realgo/services/api/internal/service"
)

const defaultQueueLimit = 50
const maxQueueLimit = 100

// ReviewHandler обрабатывает запросы для review endpoints.
type ReviewHandler struct {
	svc service.ReviewService
}

func NewReviewHandler(svc service.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// RegisterReviewRoutes подключает маршруты для reviews.
func RegisterReviewRoutes(r chi.Router, h *ReviewHandler) {
	r.Get("/queue", h.GetQueue)
	r.Post("/problems/{problemId}/attempt", h.RecordProblemAttempt)
	r.Post("/{reviewId}/rate", h.RateReview)
	r.Get("/stats", h.GetStats)
}

// RecordProblemAttempt: POST /me/reviews/problems/{problemId}/attempt
// swagger:operation POST /api/v1/me/reviews/problems/{problemId}/attempt post_api_v1_me_reviews_problems_problemId_attempt
//
// ---
// tags:
// - Reviews
// summary: Записать попытку решения задачи
// operationId: post_api_v1_me_reviews_problems_problemId_attempt
// description: Записать попытку решения задачи.
// security:
// - BearerAuth: []
// consumes:
// - application/json
// parameters:
// - name: problemId
//   in: path
//   required: true
//   description: Числовой ID, а не prb_*/card_* строка.
//   type: integer
//   format: int64
//   minimum: 1
// - name: body
//   in: body
//   required: true
//   schema:
//     $ref: '#/definitions/ReviewsRequestProblemAttemptRequest'
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
//           $ref: '#/definitions/ReviewsProblemAttemptData'
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

func (h *ReviewHandler) RecordProblemAttempt(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	problemID, err := strconv.ParseInt(chi.URLParam(r, "problemId"), 10, 64)
	if err != nil || problemID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid problemId")
		return
	}

	var req request.ProblemAttemptRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	if !req.Valid() {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "outcome must be not_solved, hard, normal, or easy")
		return
	}

	attemptedAt, err := time.Parse(time.RFC3339, req.AttemptedAt)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid attemptedAt format, expected ISO 8601")
		return
	}

	data, err := h.svc.RecordProblemAttempt(r.Context(), userID, problemID, req.Outcome, attemptedAt)
	if errors.Is(err, service.ErrReviewNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "problem not found")
		return
	}
	if errors.Is(err, service.ErrInvalidRating) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", service.ErrInvalidRating.Error())
		return
	}
	if err != nil {
		slog.Error("reviews: RecordProblemAttempt failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("problem_id", problemID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not record problem attempt")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// GetQueue: GET /me/reviews/queue
// swagger:operation GET /api/v1/me/reviews/queue get_api_v1_me_reviews_queue
//
// ---
// tags:
// - Reviews
// summary: Получить очередь повторений
// operationId: get_api_v1_me_reviews_queue
// description: Получить очередь повторений. Следующий курсор находится в meta.nextCursor как непрозрачная строка;
//   это не объект nextCursor в корне ответа.
// security:
// - BearerAuth: []
// parameters:
// - name: status
//   in: query
//   required: false
//   description: Просроченные или будущие повторения.
//   type: string
//   enum:
//   - due
//   - upcoming
//   default: due
// - name: limit
//   in: query
//   required: false
//   description: По умолчанию 50. Значения выше 100 обрезаются до 100. Нечисловое или неположительное значение заменяется
//     значением по умолчанию.
//   type: integer
//   default: 50
// - name: cursor
//   in: query
//   required: false
//   description: 'Непрозрачный курсор из meta.nextCursor. При отсутствии ключа следующей страницы нет. Невалидный
//     курсор: 400.'
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
//           type: array
//           items:
//             $ref: '#/definitions/ReviewsReviewItem'
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

func (h *ReviewHandler) GetQueue(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		slog.Warn("reviews: GetQueue failed", slog.Any("err", err))
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "due"
	}
	if !validQueueStatus(status) {
		slog.Warn("reviews: GetQueue failed", slog.Int64("user_id", userID), slog.String("status", status))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "status must be due or upcoming")
		return
	}

	limit := parseLimit(r, defaultQueueLimit)

	cursor := entity.FirstReviewQueueCursor()
	if raw := strings.TrimSpace(r.URL.Query().Get("cursor")); raw != "" {
		cursor, err = entity.DecodeReviewQueueCursor(raw)
		if err != nil {
			slog.Warn("reviews: GetQueue failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cursor")
			return
		}
	}

	resp, err := h.svc.GetQueue(r.Context(), userID, status, cursor, limit)
	if err != nil {
		slog.Error("reviews: GetQueue failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load review queue")
		return
	}

	response.JSONWithMeta(w, http.StatusOK, resp.Data, response.Meta{NextCursor: resp.Meta.NextCursor})
}

// RateReview: POST /me/reviews/{reviewId}/rate
// swagger:operation POST /api/v1/me/reviews/{reviewId}/rate post_api_v1_me_reviews_reviewId_rate
//
// ---
// tags:
// - Reviews
// summary: Оценить повторение по review ID
// operationId: post_api_v1_me_reviews_reviewId_rate
// description: 'Оценить повторение по review ID. Handler/service не требуют, чтобы повторение уже было due: тот же
//   маршрут применяется к upcoming. reviewedAt принимается в RFC3339.'
// security:
// - BearerAuth: []
// consumes:
// - application/json
// parameters:
// - name: reviewId
//   in: path
//   required: true
//   description: Числовой ID, а не prb_*/card_* строка.
//   type: integer
//   format: int64
// - name: body
//   in: body
//   required: true
//   schema:
//     $ref: '#/definitions/ReviewsRequestRateReviewRequest'
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
//           $ref: '#/definitions/ReviewsRateReviewData'
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

func (h *ReviewHandler) RateReview(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		slog.Warn("reviews: RateReview failed", slog.Any("err", err))
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	reviewID, err := strconv.ParseInt(chi.URLParam(r, "reviewId"), 10, 64)
	if err != nil {
		slog.Warn("reviews: RateReview failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid reviewId")
		return
	}

	var req request.RateReviewRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}

	if !req.Valid() {
		slog.Warn("reviews: RateReview failed", slog.Int64("user_id", userID), slog.Int64("review_id", reviewID), slog.String("rating", req.Rating))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", service.ErrInvalidRating.Error())
		return
	}

	// Парсим reviewedAt из запроса (ISO 8601)
	reviewedAt, err := time.Parse(time.RFC3339, req.ReviewedAt)
	if err != nil {
		slog.Warn("reviews: RateReview failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("review_id", reviewID))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid reviewedAt format, expected ISO 8601")
		return
	}

	data, err := h.svc.RateReview(r.Context(), reviewID, userID, req.Rating, reviewedAt)
	if err != nil {
		if errors.Is(err, service.ErrReviewNotFound) {
			slog.Warn("reviews: RateReview failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("review_id", reviewID))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}
		slog.Error("reviews: RateReview failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("review_id", reviewID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not rate review")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// GetStats: GET /me/reviews/stats
// swagger:operation GET /api/v1/me/reviews/stats get_api_v1_me_reviews_stats
//
// ---
// tags:
// - Reviews
// summary: Получить статистику повторений
// operationId: get_api_v1_me_reviews_stats
// description: Получить статистику повторений.
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
//           $ref: '#/definitions/ReviewsStatsResponse'
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

func (h *ReviewHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		slog.Warn("reviews: GetStats failed", slog.Any("err", err))
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	resp, err := h.svc.GetStats(r.Context(), userID)
	if err != nil {
		slog.Error("reviews: GetStats failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load review stats")
		return
	}

	response.JSON(w, http.StatusOK, v1response.StatsResponse{
		TotalReviews:  resp.TotalReviews,
		NewCards:      resp.NewCards,
		LearningCards: resp.LearningCards,
		ReviewCards:   resp.ReviewCards,
	})
}

// getUserID извлекает userID из контекста авторизации.
func getUserID(r *http.Request) (int64, error) {
	// Интеграция с auth.UserIDFromContext
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		return 0, errors.New("user not authenticated")
	}
	return userID, nil
}

func parseLimit(r *http.Request, defaultVal int32) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultVal
	}
	if limit > maxQueueLimit {
		return maxQueueLimit
	}
	return int32(limit)
}

func validQueueStatus(status string) bool {
	return status == "due" || status == "upcoming"
}
