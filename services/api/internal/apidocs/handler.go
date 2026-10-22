package apidocs

import (
	"bytes"
	_ "embed"
	"net/http"
	"time"

	swaggerFiles "github.com/swaggo/files/v2"
)

//go:embed swagger.json
var specification []byte

//go:embed index.html
var index []byte

// Handler serves the embedded specification and local Swagger UI assets.
// No database connection, CDN or external validator is needed to view docs.
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/docs", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/docs/", http.StatusPermanentRedirect)
	})
	mux.HandleFunc("GET /api/docs/swagger.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "swagger.json", time.Time{}, bytes.NewReader(specification))
	})
	mux.HandleFunc("GET /api/docs/{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
	assets := http.StripPrefix("/api/docs/assets/", http.FileServer(http.FS(swaggerFiles.FS)))
	for _, name := range []string{"swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js", "favicon-16x16.png", "favicon-32x32.png"} {
		mux.Handle("GET /api/docs/assets/"+name, assets)
	}
	return mux
}
