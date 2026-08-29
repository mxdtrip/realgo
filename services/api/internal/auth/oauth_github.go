package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

const (
	githubProviderName    = "github"
	defaultGitHubTokenURL = "https://github.com/login/oauth/access_token"
	defaultGitHubUserURL  = "https://api.github.com/user"
	defaultGitHubEmailURL = "https://api.github.com/user/emails"
	githubHTTPTimeout     = 8 * time.Second
	// GitHub API responses are small JSON payloads; bound the read regardless
	// so a misbehaving/compromised endpoint can't stream an unbounded body.
	maxGitHubResponseBytes = 1 << 16
	// GitHub rejects API requests with no User-Agent header (returns 403).
	githubUserAgent = "realgo.dev"
)

type githubProfile struct {
	ID    int64
	Email string
}

// LoginWithGitHub exchanges a GitHub OAuth App authorization code for an
// access token, fetches the profile it identifies and signs the matching
// local user in — creating the account on first login. See
// https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps.
// redirectURI must be the exact value used to start the authorization
// request (GitHub validates it matches the code it issued).
func (s *Service) LoginWithGitHub(ctx context.Context, code, redirectURI string) (db.User, TokenPair, error) {
	if !s.cfg.GitHub.Enabled() {
		return db.User{}, TokenPair{}, ErrOAuthUnavailable
	}

	accessToken, err := exchangeGitHubCode(ctx, s.cfg.GitHub, code, redirectURI)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	profile, err := fetchGitHubProfile(ctx, s.cfg.GitHub, accessToken)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}

	user, err := s.upsertOAuthUser(ctx, githubProviderName, strconv.FormatInt(profile.ID, 10), profile.Email)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}

	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// exchangeGitHubCode trades an authorization code for an access token via
// https://github.com/login/oauth/access_token. Unlike Yandex, GitHub answers
// invalid requests with HTTP 200 and an "error" field in the body, so the
// status code alone can't be trusted.
func exchangeGitHubCode(ctx context.Context, cfg GitHubConfig, code, redirectURI string) (string, error) {
	tokenURL := cfg.TokenURL
	if tokenURL == "" {
		tokenURL = defaultGitHubTokenURL
	}

	form := url.Values{
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}

	ctx, cancel := context.WithTimeout(ctx, githubHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("%w: build token request: %v", ErrOAuthProviderFailed, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", githubUserAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: token request: %v", ErrOAuthProviderFailed, err)
	}
	defer resp.Body.Close()

	var body struct {
		AccessToken      string `json:"access_token"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxGitHubResponseBytes)).Decode(&body); err != nil {
		return "", fmt.Errorf("%w: decode token response: %v", ErrOAuthProviderFailed, err)
	}
	if resp.StatusCode != http.StatusOK || body.AccessToken == "" || body.Error != "" {
		return "", fmt.Errorf("%w: token exchange rejected (status %d, error %q: %q)",
			ErrOAuthProviderFailed, resp.StatusCode, body.Error, body.ErrorDescription)
	}
	return body.AccessToken, nil
}

// fetchGitHubProfile loads the authenticated user's profile via
// https://api.github.com/user. GET /user only returns a public email if the
// user has set one, so a missing email falls back to /user/emails (requires
// the user:email scope) and picks the primary, verified address.
func fetchGitHubProfile(ctx context.Context, cfg GitHubConfig, accessToken string) (githubProfile, error) {
	var user struct {
		ID    int64  `json:"id"`
		Email string `json:"email"`
	}
	if err := githubAPIGet(ctx, userURLOrDefault(cfg), accessToken, &user); err != nil {
		return githubProfile{}, err
	}
	if user.ID == 0 {
		return githubProfile{}, fmt.Errorf("%w: user info missing id", ErrOAuthProviderFailed)
	}
	if user.Email != "" {
		return githubProfile{ID: user.ID, Email: user.Email}, nil
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := githubAPIGet(ctx, emailsURLOrDefault(cfg), accessToken, &emails); err != nil {
		return githubProfile{}, err
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return githubProfile{ID: user.ID, Email: e.Email}, nil
		}
	}
	return githubProfile{ID: user.ID}, nil
}

func userURLOrDefault(cfg GitHubConfig) string {
	if cfg.UserURL != "" {
		return cfg.UserURL
	}
	return defaultGitHubUserURL
}

func emailsURLOrDefault(cfg GitHubConfig) string {
	if cfg.EmailsURL != "" {
		return cfg.EmailsURL
	}
	return defaultGitHubEmailURL
}

func githubAPIGet(ctx context.Context, apiURL, accessToken string, out any) error {
	ctx, cancel := context.WithTimeout(ctx, githubHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return fmt.Errorf("%w: build request: %v", ErrOAuthProviderFailed, err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", githubUserAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: request: %v", ErrOAuthProviderFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: %s status %d", ErrOAuthProviderFailed, apiURL, resp.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxGitHubResponseBytes)).Decode(out); err != nil {
		return fmt.Errorf("%w: decode %s response: %v", ErrOAuthProviderFailed, apiURL, err)
	}
	return nil
}
