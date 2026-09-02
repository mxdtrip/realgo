package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Sender delivers the magic-link emails triggered by the auth service: a new
// account's confirmation link, and a password-reset link.
type Sender interface {
	SendVerificationEmail(ctx context.Context, email, confirmURL string, ttl time.Duration) error
	SendPasswordResetEmail(ctx context.Context, email, resetURL string, ttl time.Duration) error
}

const requestTimeout = 5 * time.Second

// NewSender returns a Sender that calls the web app's internal endpoints when
// cfg is configured, or one that only logs the link otherwise (local dev
// without SMTP set up).
func NewSender(cfg Config) Sender {
	if !cfg.Enabled() {
		return noopSender{}
	}
	return httpSender{cfg: cfg, client: &http.Client{Timeout: requestTimeout}}
}

type magicLinkRequest struct {
	To               string `json:"to"`
	URL              string `json:"url"`
	ExpiresInMinutes int    `json:"expires_in_minutes"`
}

type httpSender struct {
	cfg    Config
	client *http.Client
}

func (s httpSender) SendVerificationEmail(ctx context.Context, email, confirmURL string, ttl time.Duration) error {
	return s.post(ctx, s.cfg.sendVerificationEndpoint(), "send-verification-email", email, confirmURL, ttl)
}

func (s httpSender) SendPasswordResetEmail(ctx context.Context, email, resetURL string, ttl time.Duration) error {
	return s.post(ctx, s.cfg.sendPasswordResetEndpoint(), "send-password-reset-email", email, resetURL, ttl)
}

func (s httpSender) post(ctx context.Context, endpoint, name, email, linkURL string, ttl time.Duration) error {
	body, err := json.Marshal(magicLinkRequest{
		To:               email,
		URL:              linkURL,
		ExpiresInMinutes: int(ttl / time.Minute),
	})
	if err != nil {
		return fmt.Errorf("marshal %s request: %w", name, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build %s request: %w", name, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Secret", s.cfg.WebInternalSecret)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("call %s: %w", name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s returned status %d", name, resp.StatusCode)
	}
	return nil
}

// noopSender logs the link instead of sending it, so registration and
// password reset keep working in environments where the web app's mailer
// isn't configured (e.g. `make up-api`, or local dev without SMTP).
type noopSender struct{}

func (noopSender) SendVerificationEmail(_ context.Context, email, confirmURL string, _ time.Duration) error {
	slog.Warn("mailer: MAILER_WEB_INTERNAL_SECRET is not set, logging the confirmation link instead of emailing it",
		slog.String("email", email),
		slog.String("confirm_url", confirmURL),
	)
	return nil
}

func (noopSender) SendPasswordResetEmail(_ context.Context, email, resetURL string, _ time.Duration) error {
	slog.Warn("mailer: MAILER_WEB_INTERNAL_SECRET is not set, logging the password reset link instead of emailing it",
		slog.String("email", email),
		slog.String("reset_url", resetURL),
	)
	return nil
}
