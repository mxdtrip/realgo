package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/getsentry/sentry-go"
	"github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

func TestSentryErrorsCapturesOnlyServerErrors(t *testing.T) {
	transport := &sentry.MockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{
		Dsn:              "https://public@example.com/1",
		Transport:        transport,
		AttachStacktrace: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	hub := sentry.NewHub(client, sentry.NewScope())

	router := chi.NewRouter()
	router.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)
	router.Use(sentryErrors)
	router.Get("/failure/{id}", func(w http.ResponseWriter, _ *http.Request) {
		response.Fail(w, http.StatusInternalServerError, "DATABASE_ERROR", "query failed")
	})
	router.Get("/missing", func(w http.ResponseWriter, _ *http.Request) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "missing")
	})
	flusherAvailable := false
	router.Get("/stream", func(w http.ResponseWriter, _ *http.Request) {
		_, flusherAvailable = w.(http.Flusher)
		w.WriteHeader(http.StatusOK)
	})

	for _, path := range []string{"/missing", "/stream", "/failure/42"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req = req.WithContext(sentry.SetHubOnContext(context.Background(), hub.Clone()))
		router.ServeHTTP(httptest.NewRecorder(), req)
	}

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("captured %d events, want 1", len(events))
	}
	if !flusherAvailable {
		t.Fatal("Sentry response writer must preserve http.Flusher")
	}
	if got := events[0].Tags["error.code"]; got != "DATABASE_ERROR" {
		t.Fatalf("error.code = %q, want DATABASE_ERROR", got)
	}
	if got := events[0].Fingerprint; len(got) != 4 || got[2] != "/failure/{id}" {
		t.Fatalf("fingerprint = %v, want normalized route", got)
	}
}
