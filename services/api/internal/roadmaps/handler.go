package roadmaps

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

const neetcode150Code = "neetcode_150"

type Handler struct {
	repo repository
}

type repository interface {
	List(ctx context.Context, code string) ([]Item, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/neetcode_150", h.GetNeetCode150)
}

// swagger:operation GET /api/v1/roadmaps/neetcode_150 get_api_v1_roadmaps_neetcode_150
//
// ---
// tags:
// - Roadmaps catalog
// summary: Получить публичный каталог NeetCode 150
// operationId: get_api_v1_roadmaps_neetcode_150
// description: Публичная ручка без Bearer. Административный HTML-интерфейс /admin не входит в JSON API.
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
//           $ref: '#/definitions/RoadmapsResponse'
//         meta:
//           $ref: '#/definitions/CommonMeta'
//       required:
//       - data
//   '500':
//     description: 'Внутренняя ошибка; коды: internal_error'
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

func (h *Handler) GetNeetCode150(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context(), neetcode150Code)
	if err != nil {
		slog.Error("roadmaps: GetNeetCode150 failed", slog.Any("err", err), slog.String("code", neetcode150Code))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load roadmap")
		return
	}
	response.JSON(w, http.StatusOK, Response{Code: neetcode150Code, Items: items})
}
