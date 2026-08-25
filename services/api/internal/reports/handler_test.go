package reports

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
)

type fakeRepository struct {
	input CreateInput
	err   error
}

func (f *fakeRepository) Create(_ context.Context, _ int64, input CreateInput) (string, time.Time, error) {
	f.input = input
	return "12b3b7f9-7b92-4ea6-b745-7ae9c0199a92", time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC), f.err
}

func TestHandlerCreatesReportWithRequestID(t *testing.T) {
	repo := &fakeRepository{}
	h := NewHandler(repo)
	body, err := json.Marshal(validRequest())
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/me/problem-reports", bytes.NewReader(body))
	ctx := auth.ContextWithUserID(req.Context(), 42)
	ctx = context.WithValue(ctx, middleware.RequestIDKey, "request-report")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.Create(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	require.Equal(t, "request-report", repo.input.SourceRequestID)
	require.Contains(t, w.Body.String(), `"reportId":"12b3b7f9-7b92-4ea6-b745-7ae9c0199a92"`)
}

func TestHandlerCreatesMultipartReportWithAttachment(t *testing.T) {
	repo := &fakeRepository{}
	h := NewHandler(repo)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	reportPart, err := writer.CreateFormField("report")
	require.NoError(t, err)
	require.NoError(t, json.NewEncoder(reportPart).Encode(validRequest()))
	filePart, err := writer.CreateFormFile("attachment", "console.log")
	require.NoError(t, err)
	_, err = filePart.Write([]byte("loading never finished"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/me/problem-reports", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx := auth.ContextWithUserID(req.Context(), 42)
	ctx = context.WithValue(ctx, middleware.RequestIDKey, "request-report")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.Create(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	require.Equal(t, []byte("loading never finished"), repo.input.Attachment)
	require.Equal(t, "console.log", repo.input.AttachmentName)
	require.Equal(t, "text/plain", repo.input.AttachmentMIME)
}

func TestHandlerRejectsUnknownFields(t *testing.T) {
	h := NewHandler(&fakeRepository{})
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"unknown":true}`))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	w := httptest.NewRecorder()
	h.Create(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandlerDoesNotLeakRepositoryError(t *testing.T) {
	h := NewHandler(&fakeRepository{err: errors.New("postgres secret")})
	body, _ := json.Marshal(validRequest())
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
	ctx := auth.ContextWithUserID(req.Context(), 42)
	ctx = context.WithValue(ctx, middleware.RequestIDKey, "request-report")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	h.Create(w, req)
	require.Equal(t, http.StatusInternalServerError, w.Code)
	require.NotContains(t, w.Body.String(), "postgres secret")
}
