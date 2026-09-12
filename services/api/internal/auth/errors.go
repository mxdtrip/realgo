package auth

import "errors"

// Sentinel errors returned by the service. The HTTP layer maps each of these to
// a status code and a stable error code in the response envelope.
var (
	ErrInvalidEmail       = errors.New("invalid email")
	ErrWeakPassword       = errors.New("password too short")
	ErrPasswordTooLong    = errors.New("password too long")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidToken       = errors.New("invalid or expired token")

	// ErrOAuthUnavailable is returned when an OAuth provider (e.g. Yandex ID)
	// has no client id/secret configured.
	ErrOAuthUnavailable = errors.New("oauth provider not configured")
	// ErrOAuthProviderFailed wraps any unexpected response from the OAuth
	// provider (token exchange or profile lookup).
	ErrOAuthProviderFailed = errors.New("oauth provider request failed")
	// ErrOAuthNoEmail is returned when the provider account has no usable
	// (verified) email address to register or link the local account with.
	ErrOAuthNoEmail = errors.New("oauth account has no usable email")
)
