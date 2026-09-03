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
	"strconv"
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

// fakeGitHubServer stands in for github.com/login/oauth/access_token,
// api.github.com/user and api.github.com/user/emails. userEmail is what
// GET /user returns (omitted when empty, mirroring a private profile email);
// emailsPrimary is the verified primary address /user/emails supplies
// (omitted from the list when empty) — LoginWithGitHub only consults it when
// /user came back without an email.
func fakeGitHubServer(t *testing.T, id int64, userEmail, emailsPrimary string) *httptest.Server {
	t.Helper()
	const accessToken = "fake-github-token"
	mux := http.NewServeMux()
	mux.HandleFunc("/login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.NotEmpty(t, r.FormValue("code"))
		require.NotEmpty(t, r.FormValue("client_id"))
		require.NotEmpty(t, r.FormValue("client_secret"))
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": accessToken,
			"token_type":   "bearer",
			"scope":        "read:user,user:email",
		})
	})
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+accessToken, r.Header.Get("Authorization"))
		body := map[string]any{"id": id, "login": "octocat-" + strconv.FormatInt(id, 10)}
		if userEmail != "" {
			body["email"] = userEmail
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(body)
	})
	mux.HandleFunc("/user/emails", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+accessToken, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		if emailsPrimary == "" {
			_ = json.NewEncoder(w).Encode([]any{})
			return
		}
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"email": "secondary+" + emailsPrimary, "primary": false, "verified": true},
			{"email": emailsPrimary, "primary": true, "verified": true},
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func newGitHubTestServer(t *testing.T, github auth.GitHubConfig) (http.Handler, func()) {
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
		GitHub:     github,
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

func postGitHubLogin(t *testing.T, h http.Handler, payload map[string]any) (int, map[string]any) {
	t.Helper()
	b, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/github", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	var out map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	return w.Code, out
}

func TestGitHubLoginCreatesAccountOnFirstSignIn(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "github-" + suffix + "@example.test"
	githubID := time.Now().UnixNano()

	fake := fakeGitHubServer(t, githubID, email, "")
	h, cleanup := newGitHubTestServer(t, auth.GitHubConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/login/oauth/access_token",
		UserURL:  fake.URL + "/user", EmailsURL: fake.URL + "/user/emails",
	})
	defer cleanup()
	defer cleanupUserByEmail(t, email)

	status, first := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code-1", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusOK, status, first)
	firstUser := first["data"].(map[string]any)["user"].(map[string]any)
	require.Equal(t, email, firstUser["email"])

	status, second := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code-2", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusOK, status, second)
	secondUser := second["data"].(map[string]any)["user"].(map[string]any)
	require.Equal(t, firstUser["id"], secondUser["id"])
}

func TestGitHubLoginFallsBackToUserEmailsWhenPublicEmailIsEmpty(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "github-private-" + suffix + "@example.test"
	githubID := time.Now().UnixNano()

	// Empty userEmail forces LoginWithGitHub to fall back to /user/emails.
	fake := fakeGitHubServer(t, githubID, "", email)
	h, cleanup := newGitHubTestServer(t, auth.GitHubConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/login/oauth/access_token",
		UserURL:  fake.URL + "/user", EmailsURL: fake.URL + "/user/emails",
	})
	defer cleanup()
	defer cleanupUserByEmail(t, email)

	status, body := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusOK, status, body)
	require.Equal(t, email, body["data"].(map[string]any)["user"].(map[string]any)["email"])
}

func TestGitHubLoginLinksExistingPasswordAccountByEmail(t *testing.T) {
	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "github-link-" + suffix + "@example.test"
	githubID := time.Now().UnixNano()

	fake := fakeGitHubServer(t, githubID, email, "")
	h, cleanup := newGitHubTestServer(t, auth.GitHubConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/login/oauth/access_token",
		UserURL:  fake.URL + "/user", EmailsURL: fake.URL + "/user/emails",
	})
	defer cleanup()
	defer cleanupUserByEmail(t, email)

	registered := postJSON(t, h, "/api/v1/auth/register", "", map[string]any{"email": email, "password": "Password123!"})
	registeredID := registered["data"].(map[string]any)["user"].(map[string]any)["id"]

	status, linked := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusOK, status, linked)
	require.Equal(t, registeredID, linked["data"].(map[string]any)["user"].(map[string]any)["id"])
}

func TestGitHubLoginRejectsWhenNotConfigured(t *testing.T) {
	h, cleanup := newGitHubTestServer(t, auth.GitHubConfig{})
	defer cleanup()

	status, body := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusServiceUnavailable, status, body)
}

func TestGitHubLoginRejectsAccountWithoutEmail(t *testing.T) {
	githubID := time.Now().UnixNano()
	fake := fakeGitHubServer(t, githubID, "", "")
	h, cleanup := newGitHubTestServer(t, auth.GitHubConfig{
		ClientID: "test-client", ClientSecret: "test-secret",
		TokenURL: fake.URL + "/login/oauth/access_token",
		UserURL:  fake.URL + "/user", EmailsURL: fake.URL + "/user/emails",
	})
	defer cleanup()

	status, body := postGitHubLogin(t, h, map[string]any{
		"code": "auth-code", "redirect_uri": "https://app.example.test/auth/github/callback",
	})
	require.Equal(t, http.StatusUnprocessableEntity, status, body)
}
