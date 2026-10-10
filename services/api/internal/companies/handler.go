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
