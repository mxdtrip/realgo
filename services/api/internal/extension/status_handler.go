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
// swagger:operation GET /api/v1/me/extension/status get_api_v1_me_extension_status
//
// ---
// tags:
// - Extension
// summary: Получить состояние синхронизации расширения
// operationId: get_api_v1_me_extension_status
// description: Получить состояние синхронизации расширения.
// security:
// - BearerAuth: []
// parameters:
// - name: limit
//   in: query
//   required: false
//   description: Количество последних событий. По умолчанию 10; значения выше 50 обрезаются до 50. Нечисловое или
//     неположительное значение заменяется на 10.
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
//           $ref: '#/definitions/ExtensionStatusResponse'
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
