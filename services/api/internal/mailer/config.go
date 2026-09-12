// Package mailer triggers transactional email delivery. It does not send mail
// itself: the SMTP credentials and the actual send live in apps/web (see
// apps/web/app/api/internal/), and this package only makes the
// server-to-server call that asks it to.
package mailer

import (
	"fmt"
	"os"
	"strings"
)

// Config points at the web app's internal send endpoint.
type Config struct {
	// WebInternalURL is the base URL of the web app, reachable from the API
	// container (e.g. http://web:3000 inside docker compose).
	WebInternalURL string
	// WebInternalSecret authenticates this server-to-server call. Empty means
	// no mailer is configured: SendVerificationEmail logs the link instead of
	// calling out, so local development works without SMTP set up.
	WebInternalSecret string
}

const defaultWebInternalURL = "http://web:3000"

// LoadConfig reads the mailer configuration from the environment.
func LoadConfig() Config {
	url := strings.TrimRight(os.Getenv("MAILER_WEB_INTERNAL_URL"), "/")
	if url == "" {
		url = defaultWebInternalURL
	}
	return Config{
		WebInternalURL:    url,
		WebInternalSecret: os.Getenv("MAILER_WEB_INTERNAL_SECRET"),
	}
}

// Enabled reports whether the API can reach a web app configured to send.
func (c Config) Enabled() bool {
	return c.WebInternalSecret != ""
}

func (c Config) sendVerificationEndpoint() string {
	return fmt.Sprintf("%s/api/internal/send-verification-email", c.WebInternalURL)
}

func (c Config) sendPasswordResetEndpoint() string {
	return fmt.Sprintf("%s/api/internal/send-password-reset-email", c.WebInternalURL)
}
