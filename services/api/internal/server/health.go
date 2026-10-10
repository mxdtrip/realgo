package server

import (
	"log/slog"
	"net/http"

	"github.com/mxdtrip/realgo/services/api/internal/server/response"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres"
	"github.com/mxdtrip/realgo/services/api/internal/storage/redis"
)

// healthHandler serves the liveness and readiness probes.
type healthHandler struct {
	pg    *postgres.Storage
	redis *redis.Storage
}

// live reports that the process is up. It does not touch dependencies, so it
// stays green during a transient Postgres or Redis outage.
// swagger:operation GET /healthz Health get_healthz
//
// ---
// summary: "Проверить, что API запущен"
// description: "Проверить, что API запущен."
// responses:
//   "200": {$ref: "#/responses/live"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *healthHandler) live(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ready reports whether the service can serve traffic: both Postgres and Redis
// must answer a ping.
// swagger:operation GET /readyz Health get_readyz
//
// ---
// summary: "Проверить доступность PostgreSQL и Redis"
// description: "Проверить доступность PostgreSQL и Redis."
// responses:
//   "200": {$ref: "#/responses/ready"}
//   "503": {$ref: "#/responses/dependenciesUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *healthHandler) ready(w http.ResponseWriter, r *http.Request) {
	if h.pg == nil {
		slog.Error("server: health ready failed", slog.String("reason", "postgres not configured"))
		response.Fail(w, http.StatusServiceUnavailable, "postgres_unavailable", "postgres is not configured")
		return
	}
	if h.redis == nil {
		slog.Error("server: health ready failed", slog.String("reason", "redis not configured"))
		response.Fail(w, http.StatusServiceUnavailable, "redis_unavailable", "redis is not configured")
		return
	}
	if err := h.pg.Pool.Ping(r.Context()); err != nil {
		slog.Error("server: health ready failed", slog.Any("err", err))
		response.Fail(w, http.StatusServiceUnavailable, "postgres_unavailable", "postgres is not reachable")
		return
	}
	if err := h.redis.Client.Ping(r.Context()).Err(); err != nil {
		slog.Error("server: health ready failed", slog.Any("err", err))
		response.Fail(w, http.StatusServiceUnavailable, "redis_unavailable", "redis is not reachable")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
