package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type sentryResponseWriter struct {
	middleware.WrapResponseWriter
	request  *http.Request
	reported bool
}

func (w *sentryResponseWriter) CaptureServerError(status int, code, message string) {
	if status < http.StatusInternalServerError || w.reported {
		return
	}
	w.reported = true
	captureServerError(w.request, status, code, message)
}

// Flush preserves streaming responses such as the assistant's SSE endpoint.
func (w *sentryResponseWriter) Flush() {
	if flusher, ok := w.WrapResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func sentryErrors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hub := sentry.GetHubFromContext(r.Context()); hub != nil {
			hub.Scope().SetTag("request_id", middleware.GetReqID(r.Context()))
		}
		ww := &sentryResponseWriter{
			WrapResponseWriter: middleware.NewWrapResponseWriter(w, r.ProtoMajor),
			request:            r,
		}
		next.ServeHTTP(ww, r)
		setSentryRoute(r)
		if ww.Status() >= http.StatusInternalServerError && !ww.reported {
			captureServerError(r, ww.Status(), "HTTP_5XX", http.StatusText(ww.Status()))
		}
	})
}

func captureServerError(r *http.Request, status int, code, message string) {
	hub := sentry.GetHubFromContext(r.Context())
	if hub == nil {
		return
	}
	route := routePattern(r)
	hub.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentry.LevelError)
		scope.SetTag("http.status_code", strconv.Itoa(status))
		scope.SetTag("error.code", code)
		scope.SetFingerprint([]string{"http-5xx", r.Method, route, code})
		hub.CaptureException(fmt.Errorf("%s %s returned %d %s: %s", r.Method, route, status, code, message))
	})
}

func setSentryRoute(r *http.Request) {
	transaction := sentry.TransactionFromContext(r.Context())
	if transaction == nil {
		return
	}
	transaction.Name = r.Method + " " + routePattern(r)
	transaction.Source = sentry.SourceRoute
}

func routePattern(r *http.Request) string {
	if pattern := chi.RouteContext(r.Context()).RoutePattern(); pattern != "" {
		return pattern
	}
	return r.URL.Path
}
