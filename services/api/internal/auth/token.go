package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

type TokenPair struct {
	SessionID    string `json:"session_id"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

func (s *Service) tokenPair(access, refresh string) TokenPair {
	claims, _ := s.parseClaims(access)
	return TokenPair{AccessToken: access, RefreshToken: refresh, TokenType: "Bearer", ExpiresIn: int(s.cfg.AccessTTL.Seconds()), SessionID: claims.ID}
}

// Every session operation locks the owning user first. Password changes,
// reset, refresh and revoke-all therefore have a single serial order.
func (s *Service) issueTokens(ctx context.Context, userID int64, now time.Time) (TokenPair, error) {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return TokenPair{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err = tx.QueryRow(ctx, "SELECT id FROM users WHERE id=$1 FOR UPDATE", userID).Scan(&userID); err != nil {
		return TokenPair{}, sessionLookupError(err)
	}
	pair, err := s.createSession(ctx, tx, userID, now)
	if err != nil {
		return TokenPair{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TokenPair{}, err
	}
	return pair, nil
}

func (s *Service) createSession(ctx context.Context, tx pgx.Tx, userID int64, now time.Time) (TokenPair, error) {
	sid, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	_, err = tx.Exec(ctx, "INSERT INTO auth_sessions(id,user_id,refresh_hash,expires_at) VALUES($1,$2,$3,$4)", sid, userID, credentialHash(refresh), now.Add(s.cfg.RefreshTTL))
	if err != nil {
		return TokenPair{}, err
	}
	access, err := s.issueAccessToken(userID, now, sid)
	if err != nil {
		return TokenPair{}, err
	}
	return s.tokenPair(access, refresh), nil
}

func (s *Service) issueAccessToken(userID int64, now time.Time, sessionID string) (string, error) {
	sid := sessionID
	claims := jwt.RegisteredClaims{Issuer: s.cfg.Issuer, Audience: jwt.ClaimStrings{s.cfg.Issuer}, Subject: strconv.FormatInt(userID, 10), ID: sid, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTTL))}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.JWTSecret)
}

func (s *Service) parseClaims(token string) (*jwt.RegisteredClaims, error) {
	parsed, err := jwt.ParseWithClaims(token, &jwt.RegisteredClaims{}, func(t *jwt.Token) (any, error) { return s.cfg.JWTSecret, nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(s.cfg.Issuer), jwt.WithAudience(s.cfg.Issuer), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || !parsed.Valid || claims.ID == "" || claims.IssuedAt == nil {
		return nil, ErrInvalidToken
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ParseAccessToken verifies cryptographic claims. HTTP callers must also use
// ValidateAccessToken to enforce the authoritative session lifecycle.
func (s *Service) ParseAccessToken(token string) (int64, error) {
	claims, err := s.parseClaims(token)
	if err != nil {
		return 0, err
	}
	id, _ := strconv.ParseInt(claims.Subject, 10, 64)
	return id, nil
}
func (s *Service) ValidateAccessToken(ctx context.Context, token string) (int64, error) {
	claims, err := s.parseClaims(token)
	if err != nil {
		return 0, err
	}
	session, err := s.queries.GetAuthSession(ctx, claims.ID)
	if err != nil {
		return 0, sessionLookupError(err)
	}
	if strconv.FormatInt(session.UserID, 10) != claims.Subject {
		return 0, ErrInvalidToken
	}
	return session.UserID, nil
}

// Device sessions are children of a live session, checked again under the same
// user lock used by logout/reset. A revoked bearer cannot mint a new session.
func (s *Service) NewSessionFromAccess(ctx context.Context, token, parentRefresh string) (TokenPair, error) {
	claims, err := s.parseClaims(token)
	if err != nil {
		return TokenPair{}, err
	}
	id, _ := strconv.ParseInt(claims.Subject, 10, 64)
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return TokenPair{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err = tx.QueryRow(ctx, "SELECT id FROM users WHERE id=$1 FOR UPDATE", id).Scan(&id); err != nil {
		return TokenPair{}, sessionLookupError(err)
	}
	var live bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM auth_sessions WHERE id=$1 AND user_id=$2 AND refresh_hash=$3 AND expires_at>NOW())", claims.ID, id, credentialHash(parentRefresh)).Scan(&live); err != nil || !live {
		return TokenPair{}, sessionLookupError(err)
	}
	pair, err := s.createSession(ctx, tx, id, s.now())
	if err != nil {
		return TokenPair{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TokenPair{}, err
	}
	return pair, nil
}

func (s *Service) Refresh(ctx context.Context, token string) (TokenPair, error) {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return TokenPair{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var id int64
	err = tx.QueryRow(ctx, "SELECT u.id FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.refresh_hash=$1 AND s.expires_at>NOW() FOR UPDATE OF u", credentialHash(token)).Scan(&id)
	if err != nil {
		return TokenPair{}, sessionLookupError(err)
	}
	refresh, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}
	var sid string
	err = tx.QueryRow(ctx, "UPDATE auth_sessions SET refresh_hash=$2,expires_at=$3 WHERE refresh_hash=$1 AND expires_at>NOW() RETURNING id", credentialHash(token), credentialHash(refresh), s.now().Add(s.cfg.RefreshTTL)).Scan(&sid)
	if err != nil {
		return TokenPair{}, sessionLookupError(err)
	}
	access, err := s.issueAccessToken(id, s.now(), sid)
	if err != nil {
		return TokenPair{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TokenPair{}, err
	}
	return s.tokenPair(access, refresh), nil
}
func (s *Service) Logout(ctx context.Context, token string) error {
	return s.revokeRefreshToken(ctx, token)
}
func (s *Service) revokeRefreshToken(ctx context.Context, token string) error {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, "SELECT u.id FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.refresh_hash=$1 FOR UPDATE OF u", credentialHash(token))
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "DELETE FROM auth_sessions WHERE refresh_hash=$1", credentialHash(token))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) revokeAllRefreshTokens(ctx context.Context, id int64) error {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, "SELECT id FROM users WHERE id=$1 FOR UPDATE", id)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "DELETE FROM auth_sessions WHERE user_id=$1", id)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func generateRefreshToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
func credentialHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) RefreshCookieMaxAge() int { return int(s.cfg.RefreshTTL.Seconds()) }

func sessionLookupError(err error) error {
	if err == nil || errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}
