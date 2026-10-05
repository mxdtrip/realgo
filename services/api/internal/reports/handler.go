package reports

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/httpjson"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

type repository interface {
	Create(ctx context.Context, userID int64, input CreateInput) (string, time.Time, error)
}

type Handler struct{ repo repository }

func NewHandler(repo repository) *Handler { return &Handler{repo: repo} }

// swagger:operation POST /api/v1/me/problem-reports post_api_v1_me_problem_reports
//
// ---
// tags:
// - Reports
// summary: Отправить отчёт о проблеме с диагностикой
// operationId: post_api_v1_me_problem_reports
// description: 'Можно отправить JSON до 2 MiB либо multipart/form-data: report — JSON-текст ReportsRequest, attachment
//   — максимум один файл. Фото и UTF-8 текст до 5 MiB; видео до 15 MiB. Общий multipart лимит 17.5 MiB. Неизвестные
//   JSON-поля отклоняются. Лимит: 5 запросов за 600 секунд на метод/путь и identity; зависит от наличия Redis.
//
//
//   Swagger UI показывает multipart/form-data: report — JSON-текст, attachment — необязательный файл. API также принимает
//   application/json с телом ReportsRequest.'
// x-rate-limit:
//   requests: 5
//   windowSeconds: 600
//   identity: ID пользователя из контекста после requireAuth.
//   separatePerMethodAndPath: true
// security:
// - BearerAuth: []
// consumes:
// - multipart/form-data
// x-json-request-body:
//   schema:
//     $ref: '#/definitions/ReportsRequest'
//   example:
//     schemaVersion: 2
//     description: При открытии карточек не отображается список.
//     reportedAt: '2026-10-05T16:00:00Z'
//     page:
//       route: /cards
//       viewport:
//         width: 1920
//         height: 1080
//       locale: ru
//       timezone: Asia/Yekaterinburg
//       online: true
//     browser:
//       name: Firefox
//       version: '157.0'
//       engine: Gecko
//     os:
//       name: Linux
//       version: ''
//     network: null
//     breadcrumbs: []
//     errors: []
//     release:
//       version: dev
//       commit: d86d771f0751c7c1174fb2dc318c377eeeb3b297
// parameters:
// - name: report
//   in: formData
//   required: true
//   type: string
//   description: JSON-текст объекта ReportsRequest, одной строкой.
//   x-example: '{"schemaVersion": 2, "description": "При открытии карточек не отображается список.", "reportedAt":
//     "2026-10-05T16:00:00Z", "page": {"route": "/cards", "viewport": {"width": 1920, "height": 1080}, "locale": "ru",
//     "timezone": "Asia/Yekaterinburg", "online": true}, "browser": {"name": "Firefox", "version": "157.0", "engine":
//     "Gecko"}, "os": {"name": "Linux", "version": ""}, "network": null, "breadcrumbs": [], "errors": [], "release":
//     {"version": "dev", "commit": "d86d771f0751c7c1174fb2dc318c377eeeb3b297"}}'
//   default: '{"schemaVersion": 2, "description": "При открытии карточек не отображается список.", "reportedAt": "2026-10-05T16:00:00Z",
//     "page": {"route": "/cards", "viewport": {"width": 1920, "height": 1080}, "locale": "ru", "timezone": "Asia/Yekaterinburg",
//     "online": true}, "browser": {"name": "Firefox", "version": "157.0", "engine": "Gecko"}, "os": {"name": "Linux",
//     "version": ""}, "network": null, "breadcrumbs": [], "errors": [], "release": {"version": "dev", "commit": "d86d771f0751c7c1174fb2dc318c377eeeb3b297"}}'
// - name: attachment
//   in: formData
//   required: false
//   type: file
//   description: 'Необязательный один файл: фото/UTF-8 текст до 5 MiB, видео до 15 MiB.'
// responses:
//   '201':
//     description: Успешный ответ
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//       X-RateLimit-Limit:
//         description: Лимит текущего bucket.
//         type: integer
//       X-RateLimit-Remaining:
//         description: Остаток в текущем bucket.
//         type: integer
//     schema:
//       type: object
//       properties:
//         data:
//           $ref: '#/definitions/ReportsResult'
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
//   '413':
//     description: 'Превышен размер тела запроса; коды: REQUEST_TOO_LARGE'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//     schema:
//       $ref: '#/definitions/ErrorEnvelope'
//   '429':
//     description: 'Превышен лимит запросов либо AI-квота; коды: rate_limited'
//     headers:
//       X-Request-Id:
//         description: Идентификатор запроса; также доступен в meta.requestId для JSON.
//         type: string
//       Retry-After:
//         description: Для rate_limited — число секунд до повтора; при AI-квоте может отсутствовать.
//         type: integer
//         minimum: 1
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
//     description: 'Сервис или зависимость временно недоступны; коды: auth_unavailable, rate_limit_unavailable'
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

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	req, attachment, ok := decodeCreateRequest(w, r)
	if !ok {
		return
	}
	input, err := Normalize(req, middleware.GetReqID(r.Context()), attachment)
	if err != nil {
		if errors.Is(err, ErrValidation) {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		slog.Error("reports: normalize failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not prepare problem report")
		return
	}

	reportID, createdAt, err := h.repo.Create(r.Context(), userID, input)
	if err != nil {
		slog.Error("reports: create failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not save problem report")
		return
	}

	response.JSON(w, http.StatusCreated, Result{
		ReportID: reportID, Fingerprint: input.Fingerprint, ReceivedAt: createdAt.Format(time.RFC3339Nano),
	})
}

func decodeCreateRequest(w http.ResponseWriter, r *http.Request) (Request, *AttachmentUpload, bool) {
	contentType := r.Header.Get("Content-Type")
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType != "multipart/form-data" {
		var req Request
		if !httpjson.DecodeStrictLimit(w, r, &req, "VALIDATION_ERROR", MaxRequestBodyBytes) {
			return Request{}, nil, false
		}
		return req, nil, true
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxMultipartBodyBytes)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Fail(w, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE", "request body is too large")
		} else {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid multipart request")
		}
		return Request{}, nil, false
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	reportValues := r.MultipartForm.Value["report"]
	if len(reportValues) != 1 || strings.TrimSpace(reportValues[0]) == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "report part is required")
		return Request{}, nil, false
	}
	var req Request
	if err := decodeStrictJSON(strings.NewReader(reportValues[0]), &req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid report part")
		return Request{}, nil, false
	}

	files := r.MultipartForm.File["attachment"]
	if len(files) == 0 {
		return req, nil, true
	}
	if len(files) > 1 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "only one attachment is allowed")
		return Request{}, nil, false
	}
	file, err := files[0].Open()
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "could not read attachment")
		return Request{}, nil, false
	}

	data, err := io.ReadAll(io.LimitReader(file, MaxVideoAttachmentBytes+1))
	closeErr := file.Close()
	if err != nil || closeErr != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "could not read attachment")
		return Request{}, nil, false
	}
	return req, &AttachmentUpload{
		Filename:    files[0].Filename,
		ContentType: files[0].Header.Get("Content-Type"),
		Data:        data,
	}, true
}

func decodeStrictJSON(reader io.Reader, dst any) error {
	dec := json.NewDecoder(reader)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("multiple json values")
		}
		return err
	}
	return nil
}
