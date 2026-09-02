package mailer

import (
	"context"
	"sync"
	"time"
)

// Recorder is a Sender that captures links in memory instead of delivering
// them. It exists for tests that exercise the real confirm-email / password-
// reset HTTP flows (register or request reset → capture the link → submit)
// without a mailbox.
type Recorder struct {
	mu          sync.Mutex
	confirmURLs map[string]string // email -> most recently sent confirm-email URL
	resetURLs   map[string]string // email -> most recently sent password-reset URL
}

// NewRecorder returns an empty Recorder.
func NewRecorder() *Recorder {
	return &Recorder{confirmURLs: make(map[string]string), resetURLs: make(map[string]string)}
}

func (r *Recorder) SendVerificationEmail(_ context.Context, email, confirmURL string, _ time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.confirmURLs[email] = confirmURL
	return nil
}

func (r *Recorder) SendPasswordResetEmail(_ context.Context, email, resetURL string, _ time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resetURLs[email] = resetURL
	return nil
}

// LastConfirmURL returns the most recent confirmation link sent to email, or
// "" if none was captured.
func (r *Recorder) LastConfirmURL(email string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.confirmURLs[email]
}

// LastResetURL returns the most recent password-reset link sent to email, or
// "" if none was captured.
func (r *Recorder) LastResetURL(email string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.resetURLs[email]
}
