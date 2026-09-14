//go:build integration

package integration

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
	"github.com/stretchr/testify/require"
)

func TestSecurityRegistrationChallengeIsolation(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("challenge")
	t.Cleanup(func() { h.cleanupUser(email) })
	start := func(password string) map[string]any {
		return requireSuccessEnvelope(t, h.request(t, "POST", "/api/v1/auth/register", "", map[string]any{"email": email, "password": password}), 202)
	}
	owner := start("OwnerPassword123!")
	attacker := start("AttackerPassword123!")
	h.drainMail(t)
	code := regexp.MustCompile(`код: (\d{6})`).FindStringSubmatch(h.mailer.messages[len(h.mailer.messages)-1].Text)[1]
	wrong := h.request(t, "POST", "/api/v1/auth/email-verification/confirm", "", map[string]any{"email": email, "code": code, "challenge": owner["challenge"]})
	requireErrorEnvelope(t, wrong, 400, "invalid_code")
	require.NotEqual(t, owner["challenge"], attacker["challenge"])
	ownerCode := regexp.MustCompile(`код: (\d{6})`).FindStringSubmatch(h.mailer.messages[len(h.mailer.messages)-2].Text)[1]
	good := h.request(t, "POST", "/api/v1/auth/email-verification/confirm", "", map[string]any{"email": email, "code": ownerCode, "challenge": owner["challenge"]})
	requireSuccessEnvelope(t, good, 201)
	requireErrorEnvelope(t, h.request(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": email, "password": "AttackerPassword123!"}), 401, "invalid_credentials")
	h.login(t, email, "OwnerPassword123!")
	// Existing and new addresses receive the same public contract.
	duplicate := start("AnotherPassword123!")
	require.Equal(t, "verification_requested", duplicate["status"])
	require.NotContains(t, duplicate, "tokens")
}

func TestSecurityRevocationBlocksAccessAndDeviceSession(t *testing.T) {
	for _, action := range []string{"logout", "revoke", "password", "reset"} {
		t.Run(action, func(t *testing.T) {
			h := newContractHarness(t)
			email := uniqueEmail("revoke-" + action)
			t.Cleanup(func() { h.cleanupUser(email) })
			tokens := h.register(t, email, "Password123!")
			_, reset, found, err := h.auth.IssuePasswordReset(h.ctx, email)
			require.NoError(t, err)
			require.True(t, found)
			switch action {
			case "logout":
				require.NoError(t, h.auth.Logout(h.ctx, tokens.refresh))
			case "revoke":
				require.NoError(t, h.auth.RevokeAllSessions(h.ctx, tokens.userID))
			case "password":
				require.NoError(t, h.auth.ChangePassword(h.ctx, tokens.userID, "Password123!", "NewPassword456!"))
			case "reset":
				_, err = h.auth.ResetPassword(h.ctx, reset, "NewPassword456!")
				require.NoError(t, err)
			}
			requireErrorEnvelope(t, h.request(t, "GET", "/api/v1/users/me", tokens.access, nil), 401, "INVALID_TOKEN")
			requireErrorEnvelope(t, h.request(t, "POST", "/api/v1/auth/device-session", tokens.access, nil), 401, "INVALID_TOKEN")
			_, err = h.auth.Refresh(h.ctx, tokens.refresh)
			require.ErrorIs(t, err, auth.ErrInvalidToken)
			if action == "password" || action == "reset" {
				_, err = h.auth.ResetPassword(h.ctx, reset, "AnotherPassword789!")
				require.ErrorIs(t, err, auth.ErrInvalidToken)
			}
		})
	}
}
func TestSecurityConcurrentResetRequestsPersistEveryToken(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("parallel-reset")
	t.Cleanup(func() { h.cleanupUser(email) })
	h.register(t, email, "Password123!")
	var wg sync.WaitGroup
	results := make(chan string, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, token, _, err := h.auth.IssuePasswordReset(context.Background(), email)
			if err != nil {
				errs <- err
			} else {
				results <- token
			}
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var token string
	count := 0
	for value := range results {
		count++
		token = value
		sum := sha256.Sum256([]byte(value))
		var persisted bool
		require.NoError(t, h.pg.Pool.QueryRow(h.ctx, "SELECT EXISTS(SELECT 1 FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL)", fmt.Sprintf("%x", sum[:])).Scan(&persisted))
		require.True(t, persisted)
	}
	require.Equal(t, 8, count)
	_, err := h.auth.ResetPassword(h.ctx, token, "NewPassword123!")
	require.NoError(t, err)
	var active int
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, "SELECT count(*) FROM password_reset_tokens t JOIN users u ON t.user_id=u.id WHERE u.email=$1 AND t.used_at IS NULL", email).Scan(&active))
	require.Zero(t, active)
}
func TestSecurityMailRetryPersistsCredentialAndRedactsLogs(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("outbox")
	t.Cleanup(func() { h.cleanupUser(email) })
	h.register(t, email, "Password123!")
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	require.NoError(t, h.auth.QueuePasswordReset(h.ctx, email))
	h.mailer.fail = true
	h.drainMail(t)
	first := h.mailer.messages[len(h.mailer.messages)-1]
	var raw []byte
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, "SELECT payload FROM auth_mail_jobs ORDER BY id DESC LIMIT 1").Scan(&raw))
	require.NotContains(t, string(raw), email)
	require.NotContains(t, string(raw), "reset-password")
	require.NotContains(t, logs.String(), email)
	require.NotContains(t, logs.String(), "SENSITIVE SMTP MARKER")
	_, err := h.pg.Pool.Exec(h.ctx, "UPDATE auth_mail_jobs SET available_at=NOW()")
	require.NoError(t, err)
	// New service instance simulates an API restart; encrypted queue survives.
	h.auth = auth.NewService(db.New(h.pg.Pool), h.rdb.Client, auth.Config{JWTSecret: []byte(contractJWTSecret), Issuer: "freeburger", AccessTTL: time.Hour, RefreshTTL: time.Hour})
	h.mailer.fail = false
	h.drainMail(t)
	require.Equal(t, first.Text, h.mailer.messages[len(h.mailer.messages)-1].Text)
	token := regexp.MustCompile(`#token=([A-Za-z0-9_-]+)`).FindStringSubmatch(first.Text)[1]
	_, err = h.auth.ResetPassword(h.ctx, token, "NewPassword456!")
	require.NoError(t, err)
}
func TestSecurityBrowserRefreshCookieAndCSRF(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("cookie")
	t.Cleanup(func() { h.cleanupUser(email) })
	h.register(t, email, "Password123!")
	browser := func(path, origin, session, body string, cookies []*http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/api/v1/auth/"+path, strings.NewReader(body))
		r.RemoteAddr = h.remote
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		r.Header.Set("X-Realgo-Client", "web")
		r.Header.Set("X-Realgo-Session", session)
		for _, cookie := range cookies {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		h.handler.ServeHTTP(w, r)
		return w
	}
	login := browser("login", "https://test.realgo.dev", "", fmt.Sprintf(`{"email":%q,"password":"Password123!"}`, email), nil)
	require.Equal(t, 200, login.Code)
	cookies := login.Result().Cookies()
	require.Len(t, cookies, 1)
	cookie := cookies[0]
	require.True(t, cookie.HttpOnly)
	require.True(t, cookie.Secure)
	require.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	require.Empty(t, cookie.Domain)
	require.NotContains(t, login.Body.String(), "refresh_token")
	sid := strings.TrimPrefix(cookie.Name, "__Host-realgo-refresh-")
	rejected := browser("refresh", "https://attacker.invalid", sid, `{}`, cookies)
	require.Equal(t, 403, rejected.Code)
	require.Equal(t, 200, browser("refresh", "https://test.realgo.dev", sid, `{}`, cookies).Code)
	require.Equal(t, 400, browser("refresh", "https://test.realgo.dev", strings.Repeat("x", 43), `{}`, cookies).Code)
}

func TestSecurityDeviceSessionRequiresRefreshPossession(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("device-proof")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	requireErrorEnvelope(t, h.request(t, "POST", "/api/v1/auth/device-session", tokens.access, map[string]any{}), 401, "invalid_token")
	child := h.request(t, "POST", "/api/v1/auth/device-session", tokens.access, map[string]any{"refresh_token": tokens.refresh})
	data := requireSuccessEnvelope(t, child, 201)
	childTokens := tokensFromData(t, data)
	require.NotEqual(t, tokens.refresh, childTokens.refresh)
	require.NoError(t, h.auth.RevokeAllSessions(h.ctx, tokens.userID))
	requireErrorEnvelope(t, h.request(t, "GET", "/api/v1/users/me", childTokens.access, nil), 401, "INVALID_TOKEN")
}
