package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mxdtrip/realgo/services/api/internal/mail"
)

type mailJob struct {
	Kind          string
	Email         string
	PasswordHash  string
	Nickname      string
	ChallengeHash string
	Message       *mail.Message
	Skip          bool
}

// QueueRegistration does the same bcrypt+durable enqueue work whether or not
// an account exists. The worker checks existence away from the HTTP response.
func (s *Service) QueueRegistration(ctx context.Context, email, password, nickname string) (string, error) {
	normalized, err := normalizeEmail(email)
	if err != nil {
		return "", err
	}
	if err = validatePassword(password); err != nil {
		return "", err
	}
	if strings.TrimSpace(nickname) != "" {
		nickname, err = normalizeNickname(nickname)
		if err != nil {
			return "", err
		}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return "", err
	}
	challenge, err := generateRefreshToken()
	if err != nil {
		return "", err
	}
	err = s.queueMailJob(ctx, mailJob{Kind: "register", Email: normalized, PasswordHash: hash, Nickname: nickname, ChallengeHash: credentialHash(challenge)})
	return challenge, err
}
func (s *Service) QueuePasswordReset(ctx context.Context, email string) error {
	normalized, err := normalizeEmail(email)
	if err != nil {
		normalized = ""
	}
	return s.queueMailJob(ctx, mailJob{Kind: "reset", Email: normalized})
}
func (s *Service) QueueRegistrationResend(ctx context.Context, email, challenge string) error {
	normalized, err := normalizeEmail(email)
	if err != nil {
		normalized = ""
	}
	return s.queueMailJob(ctx, mailJob{Kind: "resend", Email: normalized, ChallengeHash: credentialHash(challenge)})
}
func (s *Service) jobCipher() (cipher.AEAD, error) {
	mac := hmac.New(sha256.New, s.cfg.JWTSecret)
	_, _ = mac.Write([]byte("realgo/auth-mail-outbox/v1/" + s.cfg.Issuer))
	block, err := aes.NewCipher(mac.Sum(nil))
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
func (s *Service) sealJob(job mailJob) ([]byte, error) {
	raw, err := json.Marshal(job)
	if err != nil {
		return nil, err
	}
	aead, err := s.jobCipher()
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, raw, nil), nil
}
func (s *Service) openJob(payload []byte) (mailJob, error) {
	var job mailJob
	aead, err := s.jobCipher()
	if err != nil {
		return job, err
	}
	if len(payload) < aead.NonceSize() {
		return job, errors.New("invalid mail job")
	}
	raw, err := aead.Open(nil, payload[:aead.NonceSize()], payload[aead.NonceSize():], nil)
	if err != nil {
		return job, err
	}
	err = json.Unmarshal(raw, &job)
	return job, err
}
func (s *Service) queueMailJob(ctx context.Context, job mailJob) error {
	payload, err := s.sealJob(job)
	if err != nil {
		return err
	}
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, "INSERT INTO auth_mail_jobs(payload) VALUES($1)", payload)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ProcessNextMail leases a durable job. Credential insertion and encrypted
// message persistence commit together; retries send exactly that credential.
// A process crash releases the lease after 45s. SMTP delivery is at-least-once.
func (s *Service) ProcessNextMail(ctx context.Context, sender mail.Sender, baseURL string) (bool, error) {
	tx, err := s.queries.BeginTx(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var id int64
	var payload []byte
	var attempts int
	err = tx.QueryRow(ctx, "SELECT id,payload,attempts FROM auth_mail_jobs WHERE available_at<=NOW() AND expires_at>NOW() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1").Scan(&id, &payload, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	job, err := s.openJob(payload)
	if err != nil {
		return true, err
	}
	if job.Message == nil && !job.Skip {
		if err = s.prepareMailJob(ctx, tx, &job, baseURL); err != nil {
			return true, err
		}
		payload, err = s.sealJob(job)
		if err != nil {
			return true, err
		}
	}
	if job.Skip {
		_, err = tx.Exec(ctx, "DELETE FROM auth_mail_jobs WHERE id=$1", id)
		if err != nil {
			return true, err
		}
		return true, tx.Commit(ctx)
	}
	_, err = tx.Exec(ctx, "UPDATE auth_mail_jobs SET payload=$2,attempts=attempts+1,available_at=NOW()+INTERVAL '45 seconds',expires_at=LEAST(expires_at,NOW()+INTERVAL '9 minutes') WHERE id=$1", id, payload)
	if err != nil {
		return true, err
	}
	if err = tx.Commit(ctx); err != nil {
		return true, err
	}
	sendCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	err = sender.Send(sendCtx, *job.Message)
	cancel()
	finish, dbErr := s.queries.BeginTx(ctx)
	if dbErr != nil {
		return true, dbErr
	}
	defer func() { _ = finish.Rollback(ctx) }()
	if err == nil {
		_, dbErr = finish.Exec(ctx, "DELETE FROM auth_mail_jobs WHERE id=$1", id)
		slog.Info("auth_mail_provider_accepted", slog.Int64("job_id", id), slog.String("kind", job.Kind))
	} else {
		delay := time.Duration(1<<min(attempts, 6)) * 5 * time.Second
		_, dbErr = finish.Exec(ctx, "UPDATE auth_mail_jobs SET available_at=$2 WHERE id=$1", id, s.now().Add(delay))
		// Never log provider text: it may echo addresses, credentials or message data.
		slog.Warn("auth_mail_retry_scheduled", slog.Int64("job_id", id), slog.String("kind", job.Kind), slog.Int("attempt", attempts+1))
	}
	if dbErr != nil {
		return true, dbErr
	}
	return true, finish.Commit(ctx)
}
func (s *Service) prepareMailJob(ctx context.Context, tx pgx.Tx, job *mailJob, baseURL string) error {
	var userID int64
	err := tx.QueryRow(ctx, "SELECT id FROM users WHERE email=$1 FOR UPDATE", job.Email).Scan(&userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	switch job.Kind {
	case "reset":
		if userID == 0 {
			job.Skip = true
			return nil
		}
		token, err := generateRefreshToken()
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)", userID, credentialHash(token), s.now().Add(PasswordResetTTL))
		if err != nil {
			return err
		}
		message := mail.PasswordReset(strings.TrimRight(baseURL, "/")+"/reset-password#token="+token, int(PasswordResetTTL/time.Minute))
		job.Message = &message
	case "register", "resend":
		if userID != 0 {
			job.Skip = true
			return nil
		}
		code, err := generateVerificationCode()
		if err != nil {
			return err
		}
		if job.Kind == "register" {
			_, err = tx.Exec(ctx, "INSERT INTO pending_registrations(email,password_hash,nickname,code_hash,expires_at,challenge_hash) VALUES($1,$2,NULLIF($3,''),$4,$5,$6)", job.Email, job.PasswordHash, job.Nickname, credentialHash(code), s.now().Add(EmailVerificationTTL), job.ChallengeHash)
		} else {
			tag, updateErr := tx.Exec(ctx, "UPDATE pending_registrations SET code_hash=$3,updated_at=NOW() WHERE email=$1 AND challenge_hash=$2 AND expires_at>NOW()", job.Email, job.ChallengeHash, credentialHash(code))
			err = updateErr
			if err == nil && tag.RowsAffected() == 0 {
				job.Skip = true
				return nil
			}
		}
		if err != nil {
			return err
		}
		message := mail.EmailVerification(code, int(EmailVerificationTTL/time.Minute))
		job.Message = &message
		job.PasswordHash = ""
	default:
		return errors.New("invalid mail job kind")
	}
	job.Message.To = job.Email
	return nil
}
func (s *Service) RunMailWorker(ctx context.Context, sender mail.Sender, baseURL string) {
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			for range 10 {
				worked, err := s.ProcessNextMail(ctx, sender, baseURL)
				if err != nil {
					slog.Error("auth_mail_worker_failed", slog.String("reason", "storage_or_payload"))
					break
				}
				if !worked {
					break
				}
			}
			tx, err := s.queries.BeginTx(ctx)
			if err != nil {
				continue
			}
			_, err = tx.Exec(ctx, "DELETE FROM auth_mail_jobs WHERE expires_at<=NOW()")
			if err == nil {
				_, err = tx.Exec(ctx, "DELETE FROM pending_registrations WHERE expires_at<=NOW()")
			}
			if err == nil {
				err = tx.Commit(ctx)
			}
			_ = tx.Rollback(ctx)
			if err != nil {
				slog.Warn("auth_mail_cleanup_failed")
			}
		}
	}
}
