package auth

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds the token settings. The signing secret comes from the
// environment so it is never baked into the YAML config shipped in the image.
type Config struct {
	JWTSecret  []byte
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	Issuer     string
	Yandex     YandexConfig
	GitHub     GitHubConfig
}

// YandexConfig holds the "Sign in with Yandex ID" OAuth client credentials.
// TokenURL/UserInfoURL are only ever set in tests (to point at a fake
// server) — production always falls back to the real Yandex endpoints.
type YandexConfig struct {
	ClientID     string
	ClientSecret string
	TokenURL     string
	UserInfoURL  string
}

// Enabled reports whether Yandex ID sign-in is configured. Like AI.Enabled(),
// an empty client id/secret disables the feature instead of failing startup.
func (c YandexConfig) Enabled() bool {
	return c.ClientID != "" && c.ClientSecret != ""
}

// GitHubConfig holds the "Sign in with GitHub" OAuth App credentials.
// TokenURL/UserURL/EmailsURL are only ever set in tests (to point at a fake
// server) — production always falls back to the real GitHub endpoints.
type GitHubConfig struct {
	ClientID     string
	ClientSecret string
	TokenURL     string
	UserURL      string
	EmailsURL    string
}

// Enabled reports whether GitHub sign-in is configured.
func (c GitHubConfig) Enabled() bool {
	return c.ClientID != "" && c.ClientSecret != ""
}

const (
	defaultAccessTTL  = 15 * time.Minute
	defaultRefreshTTL = 30 * 24 * time.Hour
	minSecretLen      = 32
	issuer            = "freeburger"
	placeholderSecret = "replace-with-at-least-32-random-characters"
)

// LoadConfig reads the auth configuration from the environment. AUTH_JWT_SECRET
// is required; AUTH_ACCESS_TTL and AUTH_REFRESH_TTL fall back to sane defaults.
func LoadConfig() (Config, error) {
	secret := os.Getenv("AUTH_JWT_SECRET")
	if len(secret) < minSecretLen {
		return Config{}, fmt.Errorf("AUTH_JWT_SECRET must be set and at least %d characters", minSecretLen)
	}
	if isPlaceholderSecret(secret) {
		return Config{}, fmt.Errorf("AUTH_JWT_SECRET must not use the example placeholder")
	}

	accessTTL, err := positiveDurationEnv("AUTH_ACCESS_TTL", defaultAccessTTL)
	if err != nil {
		return Config{}, err
	}
	refreshTTL, err := positiveDurationEnv("AUTH_REFRESH_TTL", defaultRefreshTTL)
	if err != nil {
		return Config{}, err
	}

	return Config{
		JWTSecret:  []byte(secret),
		AccessTTL:  accessTTL,
		RefreshTTL: refreshTTL,
		Issuer:     issuer,
		Yandex: YandexConfig{
			ClientID:     os.Getenv("YANDEX_CLIENT_ID"),
			ClientSecret: os.Getenv("YANDEX_CLIENT_SECRET"),
		},
		GitHub: GitHubConfig{
			ClientID:     os.Getenv("GITHUB_CLIENT_ID"),
			ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		},
	}, nil
}

func isPlaceholderSecret(secret string) bool {
	normalized := strings.TrimSpace(strings.ToLower(secret))
	return normalized == placeholderSecret || strings.Contains(normalized, "replace-with")
}

func positiveDurationEnv(key string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}
	if d <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero", key)
	}
	return d, nil
}
