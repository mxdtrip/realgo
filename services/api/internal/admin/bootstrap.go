package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	minAdminPasswordBytes = 12
	maxAdminPasswordBytes = 72
)

// Bootstrap creates the first administrator without committing public credentials.
// An existing account keeps its current password.
func Bootstrap(ctx context.Context, pool *pgxpool.Pool, username, password string) error {
	username, err := validateBootstrapInput(username, password)
	if err != nil || username == "" {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO goadmin_users (username, password, name)
		VALUES ($1, $2, $1)
		ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
		RETURNING id
	`, username, string(hash)).Scan(&userID)
	if err != nil {
		return fmt.Errorf("upsert admin user: %w", err)
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO goadmin_role_users (role_id, user_id)
		SELECT 1, $1
		WHERE NOT EXISTS (
			SELECT 1 FROM goadmin_role_users WHERE role_id = 1 AND user_id = $1
		)
	`, userID); err != nil {
		return fmt.Errorf("assign administrator role: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func validateBootstrapInput(username, password string) (string, error) {
	username = strings.TrimSpace(username)
	if username == "" && password == "" {
		return "", nil
	}
	if username == "" || password == "" {
		return "", errors.New("GOADMIN_USERNAME and GOADMIN_PASSWORD must be set together")
	}
	if len(username) > 100 {
		return "", errors.New("GOADMIN_USERNAME must not exceed 100 bytes")
	}
	if len(password) < minAdminPasswordBytes || len(password) > maxAdminPasswordBytes {
		return "", fmt.Errorf("GOADMIN_PASSWORD must contain %d-%d bytes", minAdminPasswordBytes, maxAdminPasswordBytes)
	}
	return username, nil
}
