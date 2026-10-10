package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

const minPasswordLen = 8
const maxPasswordBytes = 72
const minNicknameRunes = 3
const maxNicknameRunes = 32

// Recovery links are bearer credentials; verification codes are intentionally
// shorter for a human to type, so they have a tighter expiry and are scoped to
// an already authenticated account.
const PasswordResetTTL = 30 * time.Minute
const EmailVerificationTTL = 10 * time.Minute

// A valid pre-computed bcrypt hash keeps the unknown-account login path close
// in cost to the wrong-password path. Its plaintext is irrelevant and is never
// used by the application.
const dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Service implements registration, authentication and the token lifecycle.
type Service struct {
	queries *db.Queries
	redis   *goredis.Client
	cfg     Config
	now     func() time.Time
}

// NewService wires the auth service over the user store and Redis.
func NewService(queries *db.Queries, redis *goredis.Client, cfg Config) *Service {
	return &Service{
		queries: queries,
		redis:   redis,
		cfg:     cfg,
		now:     time.Now,
	}
}

// RegisterWithoutEmailVerification creates an already verified account and a
// browser session. Only explicitly configured non-production servers call it.
func (s *Service) RegisterWithoutEmailVerification(ctx context.Context, email, password string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err = validatePassword(password); err != nil {
		return db.User{}, TokenPair{}, err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := s.queries.WithTx(tx)
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        normalized,
		PasswordHash: pgtype.Text{String: hash, Valid: true},
	})
	if isUniqueViolation(err) {
		return db.User{}, TokenPair{}, ErrEmailTaken
	}
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err = q.MarkUserEmailVerified(ctx, user.ID); err != nil {
		return db.User{}, TokenPair{}, err
	}
	tokens, err := s.createSession(ctx, tx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// CompleteRegistration atomically consumes the pending code and creates the
// account. No code, no row in users, no access or refresh token.
func (s *Service) CompleteRegistration(ctx context.Context, email, code, challenge string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil || len(code) != 6 || len(challenge) < 32 {
		return db.User{}, TokenPair{}, ErrInvalidToken
	}
	codeHash := sha256.Sum256([]byte(code))
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return db.User{}, TokenPair{}, fmt.Errorf("begin registration confirmation: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	q := s.queries.WithTx(tx)
	pending, err := q.ConsumePendingRegistration(ctx, db.ConsumePendingRegistrationParams{Email: normalized, ChallengeHash: credentialHash(challenge), CodeHash: fmt.Sprintf("%x", codeHash[:])})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, TokenPair{}, ErrInvalidToken
	}
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	user, err := q.CreateUser(ctx, db.CreateUserParams{Email: pending.Email, PasswordHash: pgtype.Text{String: pending.PasswordHash, Valid: true}, Nickname: pending.Nickname})
	if isUniqueViolation(err) {
		return db.User{}, TokenPair{}, ErrEmailTaken
	}
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err := q.MarkUserEmailVerified(ctx, user.ID); err != nil {
		return db.User{}, TokenPair{}, err
	}
	tokens, err := s.createSession(ctx, tx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.User{}, TokenPair{}, err
	}
	committed = true

	return user, tokens, nil
}

func normalizeNickname(value string) (string, error) {
	nickname := strings.TrimSpace(value)
	length := utf8.RuneCountInString(nickname)
	if length < minNicknameRunes || length > maxNicknameRunes {
		return "", ErrInvalidNickname
	}
	for _, char := range nickname {
		if unicode.IsLetter(char) || unicode.IsDigit(char) || char == '_' || char == '-' {
			continue
		}
		return "", ErrInvalidNickname
	}
	return nickname, nil
}

// Login verifies credentials and issues a token pair. It returns
// ErrInvalidCredentials for both an unknown email and a wrong password so the
// endpoint does not leak which accounts exist.
func (s *Service) Login(ctx context.Context, email, password string) (db.User, TokenPair, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}

	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// Serialize password verification and session creation with password changes.
	var lockedID int64
	err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email=$1 FOR UPDATE", normalized).Scan(&lockedID)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = checkPassword(dummyPasswordHash, password)
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	user, err := s.queries.WithTx(tx).GetUserByID(ctx, lockedID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = checkPassword(dummyPasswordHash, password)
			return db.User{}, TokenPair{}, ErrInvalidCredentials
		}
		return db.User{}, TokenPair{}, err
	}
	if !checkPassword(passwordHashOrDummy(user.PasswordHash), password) || !user.PasswordHash.Valid {
		return db.User{}, TokenPair{}, ErrInvalidCredentials
	}

	tokens, err := s.createSession(ctx, tx, user.ID, s.now())
	if err != nil {
		return db.User{}, TokenPair{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.User{}, TokenPair{}, err
	}
	return user, tokens, nil
}

// ChangePassword verifies the current password and atomically replaces its hash.
// The database trigger invalidates all sessions and unused reset credentials.
func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	if !checkPassword(passwordHashOrDummy(user.PasswordHash), currentPassword) || !user.PasswordHash.Valid {
		return ErrInvalidCredentials
	}
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tag, err := tx.Exec(ctx, "UPDATE users SET password_hash=$2, updated_at=NOW() WHERE id=$1 AND password_hash=$3", userID, hash, user.PasswordHash.String)
	rows := tag.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrInvalidToken
	}
	return tx.Commit(ctx)
}

// IssuePasswordReset creates a one-time opaque credential. Unknown and
// malformed addresses deliberately return found=false to prevent enumeration.
func (s *Service) IssuePasswordReset(ctx context.Context, email string) (db.User, string, bool, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return db.User{}, "", false, nil
	}
	user, err := s.queries.GetUserByEmail(ctx, normalized)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, "", false, nil
	}
	if err != nil {
		return db.User{}, "", false, err
	}
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return db.User{}, "", false, fmt.Errorf("generate reset token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw[:])
	hash := sha256.Sum256([]byte(token))
	err = s.queries.CreatePasswordResetToken(ctx, db.CreatePasswordResetTokenParams{UserID: user.ID, TokenHash: fmt.Sprintf("%x", hash[:]), ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(PasswordResetTTL), Valid: true}})
	if err != nil {
		return db.User{}, "", false, err
	}
	return user, token, true, nil
}

// ResetPassword consumes the token and changes the password in one database
// transaction. Existing refresh sessions are invalidated once it commits.
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) (db.User, error) {
	if err := validatePassword(newPassword); err != nil {
		return db.User{}, err
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return db.User{}, err
	}
	tokenHash := sha256.Sum256([]byte(token))
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return db.User{}, fmt.Errorf("begin password reset: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	q := s.queries.WithTx(tx)
	var lockedUser int64
	if err := tx.QueryRow(ctx, "SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>NOW() FOR UPDATE OF u", fmt.Sprintf("%x", tokenHash[:])).Scan(&lockedUser); err != nil {
		return db.User{}, ErrInvalidToken
	}
	userID, err := q.ConsumePasswordResetToken(ctx, fmt.Sprintf("%x", tokenHash[:]))
	if errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, ErrInvalidToken
	}
	if err != nil {
		return db.User{}, err
	}
	rows, err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: userID, PasswordHash: pgtype.Text{String: hash, Valid: true}})
	if err != nil {
		return db.User{}, err
	}
	if rows == 0 {
		return db.User{}, ErrInvalidToken
	}
	user, err := q.GetUserByID(ctx, userID)
	if err != nil {
		return db.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.User{}, err
	}
	committed = true

	return user, nil
}

// IssueEmailVerificationCode uses crypto/rand and stores only its SHA-256
// digest. Reissuing a code invalidates any previous unused code.
func (s *Service) IssueEmailVerificationCode(ctx context.Context, userID int64) (db.User, string, error) {
	user, err := s.UserByID(ctx, userID)
	if err != nil {
		return db.User{}, "", err
	}
	code, err := generateVerificationCode()
	if err != nil {
		return db.User{}, "", err
	}
	hash := sha256.Sum256([]byte(code))
	err = s.queries.CreateEmailVerificationCode(ctx, db.CreateEmailVerificationCodeParams{UserID: userID, CodeHash: fmt.Sprintf("%x", hash[:]), ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(EmailVerificationTTL), Valid: true}})
	if err != nil {
		return db.User{}, "", err
	}
	return user, code, nil
}

func generateVerificationCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate verification code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func (s *Service) VerifyEmailCode(ctx context.Context, userID int64, code string) error {
	if len(code) != 6 {
		return ErrInvalidToken
	}
	hash := sha256.Sum256([]byte(code))
	_, err := s.queries.ConsumeEmailVerificationCode(ctx, db.ConsumeEmailVerificationCodeParams{UserID: userID, CodeHash: fmt.Sprintf("%x", hash[:])})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}

// RevokeAllSessions invalidates all access and refresh sessions for userID, including
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
	if !checkPassword(passwordHashOrDummy(user.PasswordHash), password) || !user.PasswordHash.Valid {
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

// passwordHashOrDummy returns the stored bcrypt hash, or a precomputed dummy
// hash when the account has none (an OAuth-only signup). Comparing against a
// real bcrypt hash either way keeps this path's timing close to the
// wrong-password case instead of failing near-instantly and leaking that the
// account has no local password.
func passwordHashOrDummy(hash pgtype.Text) string {
	if hash.Valid {
		return hash.String
	}
	return dummyPasswordHash
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
