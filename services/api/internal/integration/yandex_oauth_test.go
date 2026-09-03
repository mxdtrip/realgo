//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/config"
	"github.com/mxdtrip/realgo/services/api/internal/server"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/realgo/services/api/internal/storage/redis"
)

// fakeYandexServer stands in for oauth.yandex.ru/token and login.yandex.ru/info:
// any non-empty code exchanges for a fixed access token, which resolves to the
// given profile. Mirrors the two-call shape LoginWithYandex actually drives.
func fakeYandexServer(t *testing.T, id, email string) *httptest.Server {
	t.Helper()
	const accessToken = "fake-access-token"
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "authorization_code", r.FormValue("grant_type"))
		require.NotEmpty(t, r.FormValue("code"))
		require.NotEmpty(t, r.FormValue("client_id"))
		require.NotEmpty(t, r.FormValue("client_secret"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": accessToken,
			"token_type":   "bearer",
			"expires_in":   31536000,
		})
	})
	mux.HandleFunc("/info", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "OAuth "+accessToken, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":            id,
			"login":         id,
			"default_email": email,
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func newYandexTestServer(t *testing.T, yandex auth.YandexConfig) (http.Handler, func()) {
	t.Helper()
	ctx := context.Background()
	pg, err := postgres.New(ctx, &config.Database{
		Host: "localhost", Port: 5432, User: "postgres", Password: "postgres",
		DBName: "freeburger", SSLMode: "disable", MaxConns: 2,
		MaxConnLifetime: time.Hour, MaxConnIdleTime: time.Minute,
	})
	require.NoError(t, err)

	rdb, err := redis.New(ctx, &config.Redis{Host: "localhost", Port: "6379"})
	require.NoError(t, err)

	authSvc := auth.NewService(db.New(pg.Pool), rdb.Client, auth.Config{
		JWTSecret:  []byte("integration-secret-with-more-than-32-bytes"),
		AccessTTL:  time.Hour,
		RefreshTTL: time.Hour,
		Issuer:     "freeburger",
		Yandex:     yandex,
	})
	h := server.New(server.Deps{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Postgres: pg,
		Redis:    rdb,
		Auth:     authSvc,
	})
	cleanup := func() {
		_ = rdb.Close()
		pg.Close()
	}
	return h, cleanup
}

// postYandexLogin posts to /auth/yandex without asserting a 2xx status (unlike
// postJSON in core_loop_test.go), so error-path tests can inspect the code.
func postYandexLogin(t *testing.T, h http.Handler, payload map[string]any) (int, map[string]any) {
	t.Helper()
	b, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/yandex", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	var out map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	return w.Code, out
}

func cleanupUserByEmail(t *testing.T, email string) {
	t.Helper()
	ctx := context.Background()
	pg, err := postgres.New(ctx, &config.Database{
		Host: "localhost", Port: 5432, User: "postgres", Password: "postgres",
		DBName: "freeburger", SSLMode: "disable", MaxConns: 1,
		MaxConnLifetime: time.Hour, MaxConnIdleTime: time.Minute,
	})
	if err != nil {
		return
	}
	defer pg.Close()
	_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
}

func TestYandexLoginCreatesAccountOnFirstSignIn(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	yandexID := "yandex-" + suffix
	email := "yandex-" + suffix + "@example.test"

	fake := fakeYandexServer(t, yandexID, email)
	h, cleanup := newYandexTestServer(t, auth.YandexConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/token", UserInfoURL: fake.URL + "/info",
	})
	defer cleanup()
	defer cleanupUserByEmail(t, email)

	status, first := postYandexLogin(t, h, map[string]any{
		"code": "auth-code-1", "redirect_uri": "https://app.example.test/auth/yandex/callback",
	})
	require.Equal(t, http.StatusOK, status, first)
	firstUser := first["data"].(map[string]any)["user"].(map[string]any)
	require.Equal(t, email, firstUser["email"])
	require.NotEmpty(t, first["data"].(map[string]any)["tokens"].(map[string]any)["access_token"])

	// Logging in again with the same Yandex identity must resolve to the same
	// account, not create a second one.
	status, second := postYandexLogin(t, h, map[string]any{
		"code": "auth-code-2", "redirect_uri": "https://app.example.test/auth/yandex/callback",
	})
	require.Equal(t, http.StatusOK, status, second)
	secondUser := second["data"].(map[string]any)["user"].(map[string]any)
	require.Equal(t, firstUser["id"], secondUser["id"])
}

func TestYandexLoginLinksExistingPasswordAccountByEmail(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	yandexID := "yandex-link-" + suffix
	email := "yandex-link-" + suffix + "@example.test"

	fake := fakeYandexServer(t, yandexID, email)
	h, cleanup := newYandexTestServer(t, auth.YandexConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/token", UserInfoURL: fake.URL + "/info",
	})
	defer cleanup()
	defer cleanupUserByEmail(t, email)

	registered := postJSON(t, h, "/api/v1/auth/register", "", map[string]any{"email": email, "password": "Password123!"})
	registeredID := registered["data"].(map[string]any)["user"].(map[string]any)["id"]

	status, linked := postYandexLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/yandex/callback",
	})
	require.Equal(t, http.StatusOK, status, linked)
	linkedUser := linked["data"].(map[string]any)["user"].(map[string]any)
	require.Equal(t, registeredID, linkedUser["id"])
}

func TestYandexLoginRejectsWhenNotConfigured(t *testing.T) {
	h, cleanup := newYandexTestServer(t, auth.YandexConfig{})
	defer cleanup()

	status, body := postYandexLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/yandex/callback",
	})
	require.Equal(t, http.StatusServiceUnavailable, status, body)
}

func TestYandexLoginRejectsAccountWithoutEmail(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	yandexID := "yandex-noemail-" + suffix

	fake := fakeYandexServer(t, yandexID, "")
	h, cleanup := newYandexTestServer(t, auth.YandexConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/token", UserInfoURL: fake.URL + "/info",
	})
	defer cleanup()

	status, body := postYandexLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/yandex/callback",
	})
	require.Equal(t, http.StatusUnprocessableEntity, status, body)
}
