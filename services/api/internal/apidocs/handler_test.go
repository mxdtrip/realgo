package apidocs_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/realgo/services/api/internal/apidocs"
	"github.com/mxdtrip/realgo/services/api/internal/server"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres"
)

func TestDocumentationRoutesAndLocalAssets(t *testing.T) {
	router := chi.NewRouter()
	router.Mount("/api/docs", apidocs.Handler())
	for _, tc := range []struct {
		method string
		path   string
		status int
		mime   string
	}{
		{"GET", "/api/docs", 308, ""},
		{"GET", "/api/docs/", 200, "text/html"},
		{"GET", "/api/docs/swagger.json", 200, "application/json"},
		{"HEAD", "/api/docs/swagger.json", 200, "application/json"},
		{"GET", "/api/docs/assets/swagger-ui.css", 200, "text/css"},
		{"GET", "/api/docs/assets/swagger-ui-bundle.js", 200, ""},
		{"GET", "/api/docs/assets/swagger-ui-standalone-preset.js", 200, ""},
		{"GET", "/api/docs/assets/index.html", 404, ""},
		{"GET", "/api/docs/not-a-route", 404, ""},
		{"POST", "/api/docs/swagger.json", 405, ""},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
			if w.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", w.Code, tc.status, w.Body.String())
			}
			if tc.mime != "" && !strings.HasPrefix(w.Header().Get("Content-Type"), tc.mime) {
				t.Fatalf("content type = %q", w.Header().Get("Content-Type"))
			}
			if tc.path == "/api/docs" && w.Header().Get("Location") != "/api/docs/" {
				t.Fatalf("redirect = %q", w.Header().Get("Location"))
			}
			if tc.method == http.MethodHead && w.Body.Len() != 0 {
				t.Fatal("HEAD returned a body")
			}
		})
	}
}

func TestSpecificationCoversRegisteredAPIRoutes(t *testing.T) {
	w := httptest.NewRecorder()
	apidocs.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/docs/swagger.json", nil))
	var spec struct {
		Swagger string                                `json:"swagger"`
		Paths   map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &spec); err != nil {
		t.Fatal(err)
	}
	if spec.Swagger != "2.0" {
		t.Fatalf("swagger = %q", spec.Swagger)
	}
	router := server.New(server.Deps{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Postgres: &postgres.Storage{},
	})
	registered := map[string]bool{}
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if strings.HasPrefix(route, "/api/docs") || method == "OPTIONS" {
			return nil
		}
		route = strings.TrimSuffix(route, "/")
		key := strings.ToLower(method) + " " + route
		registered[key] = true
		if len(spec.Paths[route][strings.ToLower(method)]) == 0 {
			t.Errorf("registered route missing from Swagger: %s", key)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	for path, operations := range spec.Paths {
		for method := range operations {
			if method == "parameters" {
				continue
			}
			if !registered[method+" "+path] {
				t.Errorf("Swagger operation has no route: %s %s", method, path)
			}
		}
	}
}
