package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"testing"
	"time"
)

func testService() *Service {
	return &Service{
		cfg: Config{
			JWTSecret:  []byte("test-secret-at-least-16-bytes-long"),
			AccessTTL:  15 * time.Minute,
			RefreshTTL: time.Hour,
			Issuer:     issuer,
		},
		now: time.Now,
	}
}

func TestAccessTokenRoundTrip(t *testing.T) {
	s := testService()

	tok, err := s.issueAccessToken(42, time.Now(), "test-session")
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	id, err := s.ParseAccessToken(tok)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if id != 42 {
		t.Fatalf("got user id %d, want 42", id)
	}
}

func TestExpiredAccessTokenRejected(t *testing.T) {
	s := testService()

	// Issued two hours ago: expiry (issued + 15m) is well in the past.
	tok, err := s.issueAccessToken(7, time.Now().Add(-2*time.Hour), "test-session")
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	if _, err := s.ParseAccessToken(tok); err == nil {
		t.Fatal("expected an expired token to be rejected")
	}
}

func TestTamperedAccessTokenRejected(t *testing.T) {
	s := testService()

	tok, err := s.issueAccessToken(1, time.Now(), "test-session")
	if err != nil {
		t.Fatalf("issueAccessToken: %v", err)
	}
	if _, err := s.ParseAccessToken(tok + "tampered"); err == nil {
		t.Fatal("expected a tampered token to be rejected")
	}
}

func TestRequiredClaims(t *testing.T) {
	s := testService()
	for _, mutate := range []func(*jwt.RegisteredClaims){
		func(c *jwt.RegisteredClaims) { c.ExpiresAt = nil },
		func(c *jwt.RegisteredClaims) { c.Subject = "0" },
		func(c *jwt.RegisteredClaims) { c.Subject = "-1" },
		func(c *jwt.RegisteredClaims) { c.Audience = nil },
		func(c *jwt.RegisteredClaims) { c.Issuer = "another-environment" },
		func(c *jwt.RegisteredClaims) { c.ID = "" },
		func(c *jwt.RegisteredClaims) { c.IssuedAt = nil },
	} {
		c := jwt.RegisteredClaims{Issuer: s.cfg.Issuer, Audience: jwt.ClaimStrings{s.cfg.Issuer}, Subject: "1", ID: "session", IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}
		mutate(&c)
		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.cfg.JWTSecret)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.ParseAccessToken(token); err == nil {
			t.Fatalf("accepted incomplete claims: %+v", c)
		}
	}
}
