package server

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	mailpkg "github.com/mxdtrip/realgo/services/api/internal/mail"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/realgo/services/api/internal/storage/redis"
	"github.com/mxdtrip/realgo/services/api/internal/testutil"
)

type resetTestMailbox struct {
	mu       sync.Mutex
	messages []mailpkg.Message
}

func (m *resetTestMailbox) Send(_ context.Context, message mailpkg.Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, message)
	return nil
}

func (m *resetTestMailbox) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.messages)
}

func (m *resetTestMailbox) latestResetToken(t *testing.T) string {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.messages) == 0 {
		t.Fatal("password reset did not enqueue a message")
	}
	match := regexp.MustCompile(`https://realgo\.dev/reset-password#token=([^\s<]+)`).FindStringSubmatch(m.messages[len(m.messages)-1].Text)
	if len(match) != 2 {
		t.Fatal("password reset message did not contain a reset link")
	}
	return match[1]
}

// TestPasswordResetEndToEnd exercises the public API against real Postgres and
// Redis while keeping mail inside an in-memory sender. It covers the security
// properties that cannot be proven by template-only unit tests: generic reset
// responses, expiration, one-time consumption, password replacement and
// refresh-session invalidation.
func TestPasswordResetEndToEnd(t *testing.T) {
	if testing.Short() {
		t.Skip("password reset integration test requires Docker")
	}
	harness, err := testutil.Start(t.Context())
	if err != nil {
		t.Fatalf("start test harness: %v", err)
	}
	t.Cleanup(harness.Stop)

	dbCfg := harness.DatabaseConfig()
	pg, err := postgres.New(t.Context(), &dbCfg)
	if err != nil {
		t.Fatalf("connect postgres: %v", err)
	}
	t.Cleanup(pg.Close)
	rdCfg := harness.RedisConfig()
	rd, err := redis.New(t.Context(), &rdCfg)
	if err != nil {
		t.Fatalf("connect redis: %v", err)
	}
	t.Cleanup(func() { _ = rd.Close() })

	authSvc := auth.NewService(db.New(pg.Pool), rd.Client, auth.Config{
		JWTSecret:  []byte("password-reset-integration-test-secret-32-bytes"),
		AccessTTL:  15 * time.Minute,
		RefreshTTL: 24 * time.Hour,
		Issuer:     "freeburger",
	})
	mailbox := &resetTestMailbox{}
	srv := httptest.NewServer(New(Deps{
		Logger:      slog.Default(),
		Postgres:    pg,
		Redis:       rd,
		Auth:        authSvc,
		Mailer:      mailbox,
		MailBaseURL: "https://realgo.dev",
	}))
	t.Cleanup(srv.Close)

	const email = "reset-flow@example.test"
	const oldPassword = "OldPassword-2026!"
	const newPassword = "NewPassword-2026!"
	register := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/register", map[string]string{"email": email, "password": oldPassword})
	if register.StatusCode != http.StatusAccepted {
		t.Fatalf("register status = %d, want %d", register.StatusCode, http.StatusAccepted)
	}
	var pending struct {
		Data struct {
			Challenge string `json:"challenge"`
		} `json:"data"`
	}
	decodeResetResponse(t, register, &pending)
	drain := func() {
		for range 20 {
			worked, err := authSvc.ProcessNextMail(t.Context(), mailbox, "https://realgo.dev")
			if err != nil {
				t.Fatal(err)
			}
			if !worked {
				return
			}
		}
	}
	drain()
	code := regexp.MustCompile(`код: (\d{6})`).FindStringSubmatch(mailbox.messages[0].Text)[1]
	register = postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/email-verification/confirm", map[string]string{"email": email, "code": code, "challenge": pending.Data.Challenge})
	mailbox.messages = nil
	var registered struct {
		Data struct {
			Tokens struct {
				RefreshToken string `json:"refresh_token"`
			} `json:"tokens"`
		} `json:"data"`
	}
	decodeResetResponse(t, register, &registered)
	if registered.Data.Tokens.RefreshToken == "" {
		t.Fatal("register response did not contain refresh token")
	}

	known := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/request", map[string]string{"email": email})
	unknown := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/request", map[string]string{"email": "missing@example.test"})
	if known.StatusCode != http.StatusAccepted || unknown.StatusCode != http.StatusAccepted {
		t.Fatalf("reset request statuses = %d/%d, want both %d", known.StatusCode, unknown.StatusCode, http.StatusAccepted)
	}
	var knownBody, unknownBody map[string]any
	decodeResetResponse(t, known, &knownBody)
	decodeResetResponse(t, unknown, &unknownBody)
	if !sameResetResponse(knownBody, unknownBody) {
		t.Fatal("known and unknown reset responses differ")
	}
	drain()
	if mailbox.count() != 1 {
		t.Fatalf("unknown account caused email delivery; count = %d, want 1", mailbox.count())
	}
	expiredToken := mailbox.latestResetToken(t)
	if _, err := harness.Pool.Exec(t.Context(), `UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE used_at IS NULL`); err != nil {
		t.Fatalf("expire reset token: %v", err)
	}
	expired := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/confirm", map[string]string{"token": expiredToken, "new_password": newPassword})
	if expired.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expired token status = %d, want %d", expired.StatusCode, http.StatusUnauthorized)
	}
	invalid := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/confirm", map[string]string{"token": "not-a-real-reset-token", "new_password": newPassword})
	if invalid.StatusCode != http.StatusUnauthorized {
		t.Fatalf("invalid token status = %d, want %d", invalid.StatusCode, http.StatusUnauthorized)
	}

	secondRequest := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/request", map[string]string{"email": email})
	if secondRequest.StatusCode != http.StatusAccepted {
		t.Fatalf("second reset request status = %d, want %d", secondRequest.StatusCode, http.StatusAccepted)
	}
	drain()
	token := mailbox.latestResetToken(t)
	completed := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/confirm", map[string]string{"token": token, "new_password": newPassword})
	if completed.StatusCode != http.StatusOK {
		t.Fatalf("reset confirmation status = %d, want %d", completed.StatusCode, http.StatusOK)
	}
	replay := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/password-reset/confirm", map[string]string{"token": token, "new_password": newPassword})
	if replay.StatusCode != http.StatusUnauthorized {
		t.Fatalf("used token status = %d, want %d", replay.StatusCode, http.StatusUnauthorized)
	}

	oldLogin := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/login", map[string]string{"email": email, "password": oldPassword})
	if oldLogin.StatusCode != http.StatusUnauthorized {
		t.Fatalf("old password login status = %d, want %d", oldLogin.StatusCode, http.StatusUnauthorized)
	}
	newLogin := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/login", map[string]string{"email": email, "password": newPassword})
	if newLogin.StatusCode != http.StatusOK {
		t.Fatalf("new password login status = %d, want %d", newLogin.StatusCode, http.StatusOK)
	}
	oldRefresh := postResetJSON(t, srv.Client(), srv.URL+"/api/v1/auth/refresh", map[string]string{"refresh_token": registered.Data.Tokens.RefreshToken})
	if oldRefresh.StatusCode != http.StatusUnauthorized {
		t.Fatalf("pre-reset refresh token status = %d, want %d", oldRefresh.StatusCode, http.StatusUnauthorized)
	}
}

func postResetJSON(t *testing.T, client *http.Client, url string, payload map[string]string) *http.Response {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	response, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func decodeResetResponse(t *testing.T, response *http.Response, target any) {
	t.Helper()
	defer func() { _ = response.Body.Close() }()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}

func sameResetResponse(left, right map[string]any) bool {
	// Request IDs are intentionally unique per response; only the public
	// semantic payload must be indistinguishable to prevent enumeration.
	leftJSON, leftErr := json.Marshal(left["data"])
	rightJSON, rightErr := json.Marshal(right["data"])
	return leftErr == nil && rightErr == nil && bytes.Equal(leftJSON, rightJSON)
}
