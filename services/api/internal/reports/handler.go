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
	defer func() { _ = file.Close() }()

	data, err := io.ReadAll(io.LimitReader(file, MaxVideoAttachmentBytes+1))
	if err != nil {
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
