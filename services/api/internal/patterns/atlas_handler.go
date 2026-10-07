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
// swagger:operation GET /api/v1/me/patterns/atlas Patterns get_api_v1_me_patterns_atlas
//
// ---
// summary: "Получить Pattern Atlas с company overlay"
// description: "Получить Pattern Atlas с company overlay. В проверенном коммите после Bearer-авторизации нет проверки тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/patternAtlas"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

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
// swagger:operation GET /api/v1/me/patterns/atlas/companies Patterns get_api_v1_me_patterns_atlas_companies
//
// ---
// summary: "Получить компании с evidence в атласе"
// description: "Получить компании с evidence в атласе. В проверенном коммите после Bearer-авторизации нет проверки тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/atlasCompanies"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

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
// swagger:operation GET /api/v1/me/patterns/atlas/{code} Patterns get_api_v1_me_patterns_atlas_code
//
// ---
// summary: "Получить семейство или субпаттерн атласа"
// description: "Получить семейство или субпаттерн атласа."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/patternNode"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

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
