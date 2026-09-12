package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/realgo/services/api/internal/mailer"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

const minPasswordLen = 8
const maxPasswordBytes = 72

// A valid pre-computed bcrypt hash keeps the unknown-account login path close
// in cost to the wrong-password path. Its plaintext is irrelevant and is never
// used by the application.
const dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Service implements registration, authentication and the token lifecycle.
type Service struct {
	queries *db.Queries
	redis   *goredis.Client
	cfg     Config
	mailer  mailer.Sender
	now     func() time.Time
}

// NewService wires the auth service over the user store, Redis and the
// verification-email sender.
func NewService(queries *db.Queries, redis *goredis.Client, cfg Config, sender mailer.Sender) *Service {
	return &Service{
		queries: queries,
		redis:   redis,
		cfg:     cfg,
		mailer:  sender,
		now:     time.Now,
	}
}

// Register validates the input and creates an unverified user, then sends a
// confirmation link. It does not issue tokens: the account only becomes
// usable once ConfirmEmail succeeds. If email belongs to an existing but
// still-unverified account (an earlier attempt that never got confirmed —
// e.g. a typo'd address), the password is refreshed and a fresh link is sent
// to that same account instead of permanently locking the email behind a
// link nobody can click anymore. Either way the response is identical, so
// this endpoint never reveals whether the email was already registered.
func (s *Service) Register(ctx context.Context, email, password string) (db.User, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, err
	}
	if err := validatePassword(password); err != nil {
		return db.User{}, err
	}

	hash, err := hashPassword(password)
	if err != nil {
		return db.User{}, err
	}

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{Email: normalized, PasswordHash: hash})
	if err != nil {
		if !isUniqueViolation(err) {
			return db.User{}, err
		}
		existing, getErr := s.queries.GetUserByEmail(ctx, normalized)
		if getErr != nil {
			return db.User{}, ErrEmailTaken
		}
		if existing.EmailVerifiedAt.Valid {
			return db.User{}, ErrEmailTaken
		}
		rows, updErr := s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: existing.ID, PasswordHash: hash})
		if updErr != nil {
			return db.User{}, updErr
		}
		if rows == 0 {
			return db.User{}, ErrEmailTaken
		}
		user = existing
	}

	if err := s.sendVerificationEmail(ctx, user); err != nil {
		slog.Error("auth: failed to send verification email",
			slog.String("layer", "service"),
			slog.String("module", "auth"),
			slog.Any("err", err),
			slog.Int64("user_id", user.ID),
		)
	}
	return user, nil
}

// ConfirmEmail validates a magic-link id/token pair, marks the account
// verified and issues a token pair (auto-login). The same generic error
// covers an unknown id, a wrong token, an already-used link and an expired
// one, so a guess cannot distinguish those cases.
func (s *Service) ConfirmEmail(ctx context.Context, id, token string) (db.User, TokenPair, error) {
	var verificationID pgtype.UUID
	if err := verificationID.Scan(id); err != nil {
		return db.User{}, TokenPair{}, ErrVerificationTokenInvalid
	}

	verification, err := s.queries.GetEmailVerificationByID(ctx, verificationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, TokenPair{}, ErrVerificationTokenInvalid
		}
		return db.User{}, TokenPair{}, err
	}
	if verification.ConsumedAt.Valid || !verification.ExpiresAt.Valid || s.now().After(verification.ExpiresAt.Time) {
		return db.User{}, TokenPair{}, ErrVerificationTokenInvalid
	}
	if subtle.ConstantTimeCompare([]byte(hashMagicLinkToken(token)), []byte(verification.TokenHash)) != 1 {
		return db.User{}, TokenPair{}, ErrVerificationTokenInvalid
	}

	rows, err := s.queries.ConsumeEmailVerification(ctx, verificationID)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if rows == 0 {
		// Consumed concurrently (double click, two tabs).
		return db.User{}, TokenPair{}, ErrVerificationTokenInvalid
	}
	if _, err := s.queries.MarkUserEmailVerified(ctx, verification.UserID); err != nil {
		return db.User{}, TokenPair{}, err
	}

	user, err := s.queries.GetUserByID(ctx, verification.UserID)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// ResendVerification issues and sends a fresh confirmation link for the
// account behind an (possibly expired or already-used) verification id — the
// id a confirm-email page still has after its link stopped working. It
// always succeeds from the caller's point of view — an unknown id, an
// already-verified account or a genuine send failure all resolve silently —
// so the endpoint cannot be used to probe which links or accounts exist.
func (s *Service) ResendVerification(ctx context.Context, id string) error {
	var verificationID pgtype.UUID
	if err := verificationID.Scan(id); err != nil {
		return nil
	}
	verification, err := s.queries.GetEmailVerificationByID(ctx, verificationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	return s.resendIfUnverified(ctx, verification.UserID)
}

// ResendVerificationByEmail is the same neutral resend, keyed by the email
// address a user has on hand after a "confirm your email" login rejection
// (they never received or kept a verification id at that point). Same
// anti-enumeration guarantee as ResendVerification.
func (s *Service) ResendVerificationByEmail(ctx context.Context, email string) error {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return nil
	}
	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	return s.resendIfUnverified(ctx, user.ID)
}

func (s *Service) resendIfUnverified(ctx context.Context, userID int64) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	if user.EmailVerifiedAt.Valid {
		return nil
	}
	if err := s.sendVerificationEmail(ctx, user); err != nil {
		slog.Error("auth: failed to resend verification email",
			slog.String("layer", "service"),
			slog.String("module", "auth"),
			slog.Any("err", err),
			slog.Int64("user_id", user.ID),
		)
	}
	return nil
}

// sendVerificationEmail invalidates any earlier pending link for user, mints
// a fresh single-use token and hands the confirm link to the mailer.
func (s *Service) sendVerificationEmail(ctx context.Context, user db.User) error {
	token, hash, err := newMagicLinkToken()
	if err != nil {
		return fmt.Errorf("generate verification token: %w", err)
	}
	if err := s.queries.ExpirePendingEmailVerifications(ctx, user.ID); err != nil {
		return fmt.Errorf("expire pending verifications: %w", err)
	}
	verification, err := s.queries.CreateEmailVerification(ctx, db.CreateEmailVerificationParams{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(s.cfg.EmailVerificationTTL), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("create verification: %w", err)
	}

	confirmURL := fmt.Sprintf("%s/confirm-email?id=%s&token=%s",
		s.cfg.PublicSiteURL, verification.ID.String(), url.QueryEscape(token))
	return s.mailer.SendVerificationEmail(ctx, user.Email, confirmURL, s.cfg.EmailVerificationTTL)
}

// newMagicLinkToken returns a fresh high-entropy secret and its stored hash,
// shared by email-confirmation and password-reset links. Only the hash is
// ever persisted — the plaintext token exists solely in the emailed link, so
// a database read alone cannot forge one.
func newMagicLinkToken() (token, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(buf)
	return token, hashMagicLinkToken(token), nil
}

func hashMagicLinkToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// RequestPasswordReset sends a password-reset link if email belongs to a
// known account. It always resolves successfully from the caller's point of
// view — an unknown email and a genuine send failure both resolve silently —
// so the endpoint cannot be used to probe which accounts exist.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return nil
	}
	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	token, hash, err := newMagicLinkToken()
	if err != nil {
		return fmt.Errorf("generate password reset token: %w", err)
	}
	if err := s.queries.ExpirePendingPasswordResets(ctx, user.ID); err != nil {
		return fmt.Errorf("expire pending password resets: %w", err)
	}
	reset, err := s.queries.CreatePasswordReset(ctx, db.CreatePasswordResetParams{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(s.cfg.PasswordResetTTL), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("create password reset: %w", err)
	}

	resetURL := fmt.Sprintf("%s/reset-password?id=%s&token=%s",
		s.cfg.PublicSiteURL, reset.ID.String(), url.QueryEscape(token))
	if err := s.mailer.SendPasswordResetEmail(ctx, user.Email, resetURL, s.cfg.PasswordResetTTL); err != nil {
		slog.Error("auth: failed to send password reset email",
			slog.String("layer", "service"),
			slog.String("module", "auth"),
			slog.Any("err", err),
			slog.Int64("user_id", user.ID),
		)
	}
	return nil
}

// ResetPassword validates a magic-link id/token pair, sets the new password
// and issues a token pair (auto-login). Every existing session is revoked
// first: a password reset is as much a "I may have lost control of this
// account" signal as a convenience feature. Clicking the link also proves
// mailbox ownership, so an unconfirmed registration is closed out the same
// way ConfirmEmail does. The same generic error covers an unknown id, a wrong
// token, an already-used link and an expired one, so a guess cannot
// distinguish those cases.
func (s *Service) ResetPassword(ctx context.Context, id, token, newPassword string) (db.User, TokenPair, error) {
	if err := validatePassword(newPassword); err != nil {
		return db.User{}, TokenPair{}, err
	}

	var resetID pgtype.UUID
	if err := resetID.Scan(id); err != nil {
		return db.User{}, TokenPair{}, ErrPasswordResetInvalid
	}
	reset, err := s.queries.GetPasswordResetByID(ctx, resetID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, TokenPair{}, ErrPasswordResetInvalid
		}
		return db.User{}, TokenPair{}, err
	}
	if reset.ConsumedAt.Valid || !reset.ExpiresAt.Valid || s.now().After(reset.ExpiresAt.Time) {
		return db.User{}, TokenPair{}, ErrPasswordResetInvalid
	}
	if subtle.ConstantTimeCompare([]byte(hashMagicLinkToken(token)), []byte(reset.TokenHash)) != 1 {
		return db.User{}, TokenPair{}, ErrPasswordResetInvalid
	}

	rows, err := s.queries.ConsumePasswordReset(ctx, resetID)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if rows == 0 {
		// Consumed concurrently (double click, two tabs).
		return db.User{}, TokenPair{}, ErrPasswordResetInvalid
	}

	hash, err := hashPassword(newPassword)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if _, err := s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: reset.UserID, PasswordHash: hash}); err != nil {
		return db.User{}, TokenPair{}, err
	}
	if _, err := s.queries.MarkUserEmailVerified(ctx, reset.UserID); err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err := s.revokeAllRefreshTokens(ctx, reset.UserID); err != nil {
		return db.User{}, TokenPair{}, err
	}

	user, err := s.queries.GetUserByID(ctx, reset.UserID)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// Login verifies credentials and issues a token pair. It returns
// ErrInvalidCredentials for both an unknown email and a wrong password so the
// endpoint does not leak which accounts exist.
func (s *Service) Login(ctx context.Context, email, password string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}

	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = checkPassword(dummyPasswordHash, password)
			return db.User{}, TokenPair{}, ErrInvalidCredentials
		}
		return db.User{}, TokenPair{}, err
	}
	if !checkPassword(user.PasswordHash, password) {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}
	if !user.EmailVerifiedAt.Valid {
		return db.User{}, TokenPair{}, ErrEmailNotVerified
	}

	tokens, err := s.issueTokens(ctx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// Refresh rotates a refresh token and issues a fresh token pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	// Redis can outlive a user row (for example after an account deletion on an
	// older deployment). Never consume and renew such a zombie session.
	userID, err := s.refreshTokenUserID(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	if _, err := s.queries.GetUserByID(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = s.revokeRefreshToken(ctx, refreshToken)
			return TokenPair{}, ErrInvalidToken
		}
		return TokenPair{}, err
	}

	rotatedUserID, newRefreshToken, err := s.rotateRefreshToken(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	if rotatedUserID != userID {
		_ = s.revokeRefreshToken(ctx, newRefreshToken)
		return TokenPair{}, ErrInvalidToken
	}
	access, err := s.issueAccessToken(userID, s.now())
	if err != nil {
		return TokenPair{}, err
	}
	return s.tokenPair(access, newRefreshToken), nil
}

// Logout revokes a refresh token.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.revokeRefreshToken(ctx, refreshToken)
}

// NewSession issues an independent token pair for an already authenticated
// user. Browser surfaces use it to avoid sharing one rotating refresh token.
func (s *Service) NewSession(ctx context.Context, userID int64) (TokenPair, error) {
	if _, err := s.queries.GetUserByID(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TokenPair{}, ErrInvalidToken
		}
		return TokenPair{}, err
	}
	return s.issueTokens(ctx, userID, s.now())
}

// ChangePassword verifies the current password and stores a freshly hashed new
// password. Revoking sessions remains a separate explicit operation so adding
// this endpoint does not unexpectedly sign other clients out.
func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	if !checkPassword(user.PasswordHash, currentPassword) {
		return ErrInvalidCredentials
	}
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	rows, err := s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: userID, PasswordHash: hash})
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrInvalidToken
	}
	return nil
}

// RevokeAllSessions invalidates all refresh sessions for userID, including
// legacy sessions created before the per-user Redis index existed.
func (s *Service) RevokeAllSessions(ctx context.Context, userID int64) error {
	return s.revokeAllRefreshTokens(ctx, userID)
}

// UserByID loads the user behind an authenticated request.
func (s *Service) UserByID(ctx context.Context, id int64) (db.User, error) {
	user, err := s.queries.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

// ProfileUpdate carries optional profile fields for a partial PATCH. A nil
// pointer means "not provided — keep the existing value"; a non-nil pointer
// (including an empty string) overwrites the column.
type ProfileUpdate struct {
	Timezone           *string
	InterviewDate      *time.Time
	ClearInterviewDate bool
	PrepGoal           *string
	Grade              *string
	TargetCompany      *string
	TargetPosition     *string
	Platform           *string
	TargetTopics       *[]string
	SetOnboardingDone  bool
}

// UpdateProfile applies a partial profile update for the given user.
func (s *Service) UpdateProfile(ctx context.Context, userID int64, u ProfileUpdate) (db.User, error) {
	params := db.UpdateUserProfileParams{
		ID:                     userID,
		ClearInterviewDate:     u.ClearInterviewDate,
		SetOnboardingCompleted: u.SetOnboardingDone,
	}
	if u.Timezone != nil {
		params.Timezone = pgtype.Text{String: *u.Timezone, Valid: true}
	}
	if u.InterviewDate != nil {
		params.InterviewDate = pgtype.Timestamptz{Time: *u.InterviewDate, Valid: true}
	}
	if u.PrepGoal != nil {
		params.PrepGoal = pgtype.Text{String: *u.PrepGoal, Valid: true}
	}
	if u.Grade != nil {
		params.Grade = pgtype.Text{String: *u.Grade, Valid: true}
	}
	if u.TargetCompany != nil {
		params.TargetCompany = pgtype.Text{String: *u.TargetCompany, Valid: true}
	}
	if u.TargetPosition != nil {
		params.TargetPosition = pgtype.Text{String: *u.TargetPosition, Valid: true}
	}
	if u.Platform != nil {
		params.Platform = pgtype.Text{String: *u.Platform, Valid: true}
	}
	if u.TargetTopics != nil {
		params.TargetTopics = *u.TargetTopics
	}

	user, err := s.queries.UpdateUserProfile(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

// NotificationSettings carries optional notification preferences. A nil pointer
// keeps the current preference.
type NotificationSettings struct {
	ReviewReminder *bool
	StreakReminder *bool
	WeeklyDigest   *bool
	EmailEnabled   *bool
}

// UpdateNotificationSettings applies a partial notification-preference update
// in a single atomic statement.
func (s *Service) UpdateNotificationSettings(ctx context.Context, userID int64, ns NotificationSettings) (db.User, error) {
	params := db.UpdateNotificationSettingsParams{ID: userID}
	if ns.ReviewReminder != nil {
		params.ReviewReminder = pgtype.Bool{Bool: *ns.ReviewReminder, Valid: true}
	}
	if ns.StreakReminder != nil {
		params.StreakReminder = pgtype.Bool{Bool: *ns.StreakReminder, Valid: true}
	}
	if ns.WeeklyDigest != nil {
		params.WeeklyDigest = pgtype.Bool{Bool: *ns.WeeklyDigest, Valid: true}
	}
	if ns.EmailEnabled != nil {
		params.EmailEnabled = pgtype.Bool{Bool: *ns.EmailEnabled, Valid: true}
	}

	user, err := s.queries.UpdateNotificationSettings(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	return user, err
}

// DeleteAccount permanently removes the user and all cascading/user-originated
// activity after verifying the account password. Every refresh session is
// revoked before the account row is removed.
func (s *Service) DeleteAccount(ctx context.Context, userID int64, password, refreshToken string) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	if !checkPassword(user.PasswordHash, password) {
		return ErrInvalidCredentials
	}
	if err := s.revokeAllRefreshTokens(ctx, userID); err != nil {
		return err
	}
	if err := s.deleteAccountData(ctx, userID); err != nil {
		return err
	}
	// Retained in the method/wire contract for older clients; all tokens were
	// already revoked via the user index and legacy scan above.
	_ = refreshToken
	return nil
}

// deleteAccountData erases payload-bearing child rows before the user row in
// one transaction. Separate statements are intentional: data-modifying CTEs
// execute in an unspecified order, which can race the children's ON DELETE
// SET NULL actions and leave the payload rows behind.
func (s *Service) deleteAccountData(ctx context.Context, userID int64) (err error) {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin account deletion: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil && !errors.Is(rollbackErr, pgx.ErrTxClosed) {
			err = errors.Join(err, fmt.Errorf("rollback account deletion: %w", rollbackErr))
		}
	}()

	q := s.queries.WithTx(tx)
	if _, err := q.LockUserForDeletion(ctx, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return fmt.Errorf("lock user for deletion: %w", err)
	}
	if err := q.DeleteExtensionEventsByUserID(ctx, userID); err != nil {
		return fmt.Errorf("delete extension events: %w", err)
	}
	if err := q.DeleteAIRequestLogsByUserID(ctx, userID); err != nil {
		return fmt.Errorf("delete AI request logs: %w", err)
	}
	if err := q.DeleteUserByID(ctx, userID); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit account deletion: %w", err)
	}
	committed = true
	return nil
}

func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < minPasswordLen {
		return ErrWeakPassword
	}
	if len(password) > maxPasswordBytes {
		return ErrPasswordTooLong
	}
	return nil
}

func normalizeEmail(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
