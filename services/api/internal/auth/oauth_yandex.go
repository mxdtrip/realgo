package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

const (
	yandexProviderName       = "yandex"
	defaultYandexTokenURL    = "https://oauth.yandex.ru/token"
	defaultYandexUserInfoURL = "https://login.yandex.ru/info"
	yandexHTTPTimeout        = 8 * time.Second
	// Yandex responses are a handful of JSON fields; bound the read regardless
	// so a misbehaving/compromised endpoint can't stream an unbounded body.
	maxYandexResponseBytes = 1 << 16
)

type yandexProfile struct {
	ID           string
	DefaultEmail string
}

// LoginWithYandex exchanges a Yandex ID authorization code for an access
// token, fetches the profile it identifies and signs the matching local user
// in — creating the account on first login. redirectURI must be the exact
// value used to start the authorization request (Yandex validates it matches
// the code it issued).
func (s *Service) LoginWithYandex(ctx context.Context, code, redirectURI string) (db.User, TokenPair, error) {
	if !s.cfg.Yandex.Enabled() {
		return db.User{}, TokenPair{}, ErrOAuthUnavailable
	}

	accessToken, err := exchangeYandexCode(ctx, s.cfg.Yandex, code, redirectURI)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	profile, err := fetchYandexProfile(ctx, s.cfg.Yandex, accessToken)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}

	user, err := s.upsertOAuthUser(ctx, yandexProviderName, profile.ID, profile.DefaultEmail)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}

	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// upsertOAuthUser resolves the local user for a (provider, providerUserID)
// identity: an existing link signs the linked user in; otherwise the provider
// email (trusted as pre-verified by the provider) either links an existing
// password-based account or creates a fresh OAuth-only one.
func (s *Service) upsertOAuthUser(ctx context.Context, provider, providerUserID, email string) (db.User, error) {
	account, err := s.queries.GetOAuthAccountByProvider(ctx, db.GetOAuthAccountByProviderParams{
		Provider:       provider,
		ProviderUserID: providerUserID,
	})
	if err == nil {
		return s.queries.GetUserByID(ctx, account.UserID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, err
	}

	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, ErrOAuthNoEmail
	}

	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, err
		}
		user, err = s.queries.CreateOAuthUser(ctx, normalized)
		if err != nil {
			if !isUniqueViolation(err) {
				return db.User{}, err
			}
			// Lost a race with a concurrent signup using the same email.
			user, err = s.queries.GetUserByEmail(ctx, normalized)
			if err != nil {
				return db.User{}, err
			}
		}
	}

	if _, err := s.queries.CreateOAuthAccount(ctx, db.CreateOAuthAccountParams{
		UserID:         user.ID,
		Provider:       provider,
		ProviderUserID: providerUserID,
		Email:          pgtype.Text{String: normalized, Valid: true},
	}); err != nil && !isUniqueViolation(err) {
		return db.User{}, err
	}
	return user, nil
}

// exchangeYandexCode trades an authorization code for an access token via
// https://oauth.yandex.ru/token (see https://yandex.ru/dev/id/doc/ru/access).
func exchangeYandexCode(ctx context.Context, cfg YandexConfig, code, redirectURI string) (string, error) {
	tokenURL := cfg.TokenURL
	if tokenURL == "" {
		tokenURL = defaultYandexTokenURL
	}

	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
	}

	ctx, cancel := context.WithTimeout(ctx, yandexHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("%w: build token request: %v", ErrOAuthProviderFailed, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: token request: %v", ErrOAuthProviderFailed, err)
	}
	defer resp.Body.Close()

	var body struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxYandexResponseBytes)).Decode(&body); err != nil {
		return "", fmt.Errorf("%w: decode token response: %v", ErrOAuthProviderFailed, err)
	}
	if resp.StatusCode != http.StatusOK || body.AccessToken == "" {
		return "", fmt.Errorf("%w: token exchange rejected (status %d, error %q)", ErrOAuthProviderFailed, resp.StatusCode, body.Error)
	}
	return body.AccessToken, nil
}

// fetchYandexProfile loads the authenticated user's profile via
// https://login.yandex.ru/info (see
// https://yandex.ru/dev/id/doc/ru/user-information). default_email is only
// populated when the token carries the login:email scope.
func fetchYandexProfile(ctx context.Context, cfg YandexConfig, accessToken string) (yandexProfile, error) {
	userInfoURL := cfg.UserInfoURL
	if userInfoURL == "" {
		userInfoURL = defaultYandexUserInfoURL
	}

	ctx, cancel := context.WithTimeout(ctx, yandexHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userInfoURL+"?format=json", nil)
	if err != nil {
		return yandexProfile{}, fmt.Errorf("%w: build user info request: %v", ErrOAuthProviderFailed, err)
	}
	req.Header.Set("Authorization", "OAuth "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return yandexProfile{}, fmt.Errorf("%w: user info request: %v", ErrOAuthProviderFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return yandexProfile{}, fmt.Errorf("%w: user info status %d", ErrOAuthProviderFailed, resp.StatusCode)
	}

	var body struct {
		ID           string `json:"id"`
		DefaultEmail string `json:"default_email"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxYandexResponseBytes)).Decode(&body); err != nil {
		return yandexProfile{}, fmt.Errorf("%w: decode user info: %v", ErrOAuthProviderFailed, err)
	}
	if body.ID == "" {
		return yandexProfile{}, fmt.Errorf("%w: user info missing id", ErrOAuthProviderFailed)
	}
	return yandexProfile{ID: body.ID, DefaultEmail: body.DefaultEmail}, nil
}
