package roadmap

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type repository interface {
	Get(ctx context.Context, userID int64) (Response, error)
	List(ctx context.Context, userID int64) ([]Summary, error)
	Activate(ctx context.Context, userID int64, planKey string) (Response, error)
	Preview(ctx context.Context, userID int64, req ConfigRequest) (Response, error)
	Save(ctx context.Context, userID int64, req ConfigRequest) (Response, error)
	CompleteTheory(ctx context.Context, userID int64, code string) (TheoryCompletion, error)
	ResolveTaskAccess(ctx context.Context, userID, problemID int64, action string) (TaskAccessResolution, error)
	Clear(ctx context.Context, userID int64) error
}

// swagger:operation GET /api/v1/me/roadmaps Roadmap get_api_v1_me_roadmaps
//
// ---
// summary: "Получить сохранённые roadmap-планы"
// description: "Получить сохранённые roadmap-планы."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmapList"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	data, err := h.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("roadmap: List failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not list roadmaps")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

// swagger:operation PUT /api/v1/me/roadmaps/{planKey}/activate Roadmap put_api_v1_me_roadmaps_planKey_activate
//
// ---
// summary: "Активировать сохранённый roadmap"
// description: "Активировать сохранённый roadmap."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmap"}
//   "400": {$ref: "#/responses/validationError"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Activate(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	planKey := strings.TrimSpace(chi.URLParam(r, "planKey"))
	if planKey == "" || len(planKey) > 240 {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "planKey is required", "planKey")
		return
	}
	data, err := h.repo.Activate(r.Context(), userID, planKey)
	if errors.Is(err, ErrRoadmapNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "roadmap not found")
		return
	}
	if err != nil {
		slog.Error("roadmap: Activate failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not activate roadmap")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

// CompleteTheory marks only the first-pass theory stage as complete. Problem
// and card repetitions keep using review_schedules and the shared FSRS path.
// swagger:operation PUT /api/v1/me/roadmap/patterns/{code}/theory Roadmap put_api_v1_me_roadmap_patterns_code_theory
//
// ---
// summary: "Отметить теорию субпаттерна пройденной"
// description: "Отметить теорию субпаттерна пройденной."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/theoryCompleted"}
//   "400": {$ref: "#/responses/validationError"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) CompleteTheory(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" || len(code) > 160 {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required", "code")
		return
	}
	data, err := h.repo.CompleteTheory(r.Context(), userID, code)
	if errors.Is(err, ErrSubpatternNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "subpattern not found")
		return
	}
	if err != nil {
		slog.Error("roadmap: CompleteTheory failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not complete theory")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

// ResolveTaskAccess prevents an inaccessible external problem from blocking a
// roadmap. A user may skip that slot or replace it with a comparable task.
// swagger:operation POST /api/v1/me/roadmap/tasks/{problemID}/access Roadmap post_api_v1_me_roadmap_tasks_problemID_access
//
// ---
// summary: "Заменить или пропустить недоступную задачу"
// description: "skip оставляет слот видимым, не считает задачу решённой и снимает блокировку следующего этапа. replace подбирает доступную задачу того же субпаттерна; без замены: 409 NO_REPLACEMENT. data содержит action, originalProblemId и необязательный replacementProblemId. Поля outcome/attemptedAt относятся к записи попытки решения и не являются ответом этого маршрута."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmapTaskAccess"}
//   "400": {$ref: "#/responses/validationError"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "409": {$ref: "#/responses/noReplacement"}
//   "413": {$ref: "#/responses/requestTooLarge"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) ResolveTaskAccess(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	problemID, err := strconv.ParseInt(strings.TrimSpace(chi.URLParam(r, "problemID")), 10, 64)
	if err != nil || problemID <= 0 {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "problemID must be a positive integer", "problemID")
		return
	}
	var req TaskAccessRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	req.Action = strings.TrimSpace(req.Action)
	if req.Action != "replace" && req.Action != "skip" {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "action must be replace or skip", "action")
		return
	}
	data, err := h.repo.ResolveTaskAccess(r.Context(), userID, problemID, req.Action)
	if errors.Is(err, ErrRoadmapNotFound) || errors.Is(err, ErrRoadmapTaskNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "roadmap task not found")
		return
	}
	if errors.Is(err, ErrNoTaskReplacement) {
		response.Fail(w, http.StatusConflict, "NO_REPLACEMENT", "no comparable task is available")
		return
	}
	if err != nil {
		slog.Error("roadmap: ResolveTaskAccess failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.Int64("problem_id", problemID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not update roadmap task")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

// swagger:operation GET /api/v1/me/roadmap Roadmap get_api_v1_me_roadmap
//
// ---
// summary: "Получить активный персональный roadmap"
// description: "Получить активный персональный roadmap."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmap"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("roadmap: Get failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	data, err := h.repo.Get(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			slog.Warn("roadmap: Get failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		slog.Error("roadmap: Get failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load roadmap")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// Preview calculates a roadmap without persisting it. It powers the live
// onboarding preview and the "rebuild future weeks" confirmation on /roadmap.
// swagger:operation POST /api/v1/me/roadmap/preview Roadmap post_api_v1_me_roadmap_preview
//
// ---
// summary: "Рассчитать roadmap без сохранения"
// description: "Рассчитывает план без изменения сохранённых данных. При отсутствии company evidence возвращается core-план. weeklyCapacity отсутствует в ConfigRequest этого коммита: передача поля отклоняется strict decoder с 400 VALIDATION_ERROR. Расчёт использует недельный темп по умолчанию 3. interviewDate проверяется на формат YYYY-MM-DD; ограничения строго позже сегодняшней даты в handler нет."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmap"}
//   "400": {$ref: "#/responses/validationError"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "413": {$ref: "#/responses/requestTooLarge"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Preview(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, false)
}

// Put calculates and atomically persists the roadmap config, ordered
// subpatterns and user target. Repeating the same request is deterministic.
// swagger:operation PUT /api/v1/me/roadmap Roadmap put_api_v1_me_roadmap
//
// ---
// summary: "Рассчитать и сохранить roadmap"
// description: "Сохраняет рассчитанный план и цель пользователя. Схема запроса совпадает с preview. weeklyCapacity отсутствует в ConfigRequest этого коммита: передача поля отклоняется strict decoder с 400 VALIDATION_ERROR. Расчёт использует недельный темп по умолчанию 3. interviewDate проверяется на формат YYYY-MM-DD; ограничения строго позже сегодняшней даты в handler нет."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/roadmap"}
//   "400": {$ref: "#/responses/validationError"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "404": {$ref: "#/responses/notFound"}
//   "413": {$ref: "#/responses/requestTooLarge"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Put(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, true)
}

func (h *Handler) mutate(w http.ResponseWriter, r *http.Request, persist bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	var req ConfigRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	if field, message := validateConfig(req); field != "" {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", message, field)
		return
	}
	if req.PriorityMode == "" {
		req.PriorityMode = PriorityBalanced
	}

	var data Response
	var err error
	if persist {
		data, err = h.repo.Save(r.Context(), userID, req)
	} else {
		data, err = h.repo.Preview(r.Context(), userID, req)
	}
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		slog.Error("roadmap: mutation failed", slog.Any("err", err), slog.Bool("persist", persist), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not calculate roadmap")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func validateConfig(req ConfigRequest) (string, string) {
	if len(strings.TrimSpace(req.CompanyCode)) > 120 {
		return "companyCode", "companyCode must be at most 120 characters"
	}
	if len(strings.TrimSpace(req.CompanyName)) > 200 {
		return "companyName", "companyName must be at most 200 characters"
	}
	if req.PriorityMode != "" && !isPriorityMode(req.PriorityMode) {
		return "priorityMode", "priorityMode is not supported"
	}
	if req.InterviewDate != nil && strings.TrimSpace(*req.InterviewDate) != "" {
		if _, err := time.Parse(time.DateOnly, strings.TrimSpace(*req.InterviewDate)); err != nil {
			return "interviewDate", "interviewDate must be YYYY-MM-DD or null"
		}
	}
	return "", ""
}

// Delete handles DELETE /me/roadmap — clears the onboarding-set target so
// the roadmap goes back to the empty "build your roadmap" state. Solve
// history and progress are untouched; this only resets personalization.
// swagger:operation DELETE /api/v1/me/roadmap Roadmap delete_api_v1_me_roadmap
//
// ---
// summary: "Сбросить персонализацию roadmap"
// description: "Сбрасывает персонализацию; история решений и повторений сохраняется. Успех: 204 без тела."
// security:
// - BearerAuth: []
// responses:
//   "204": {$ref: "#/responses/noContent"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("roadmap: Delete failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	if err := h.repo.Clear(r.Context(), userID); err != nil {
		slog.Error("roadmap: Delete failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not clear roadmap")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
