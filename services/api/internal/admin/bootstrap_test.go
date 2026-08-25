package admin

import (
	"strings"
	"testing"
)

func TestValidateBootstrapInput(t *testing.T) {
	tests := []struct {
		name     string
		username string
		password string
		wantUser string
		wantErr  bool
	}{
		{name: "disabled"},
		{name: "valid", username: " admin ", password: "long-enough-password", wantUser: "admin"},
		{name: "missing password", username: "admin", wantErr: true},
		{name: "missing username", password: "long-enough-password", wantErr: true},
		{name: "short password", username: "admin", password: "short", wantErr: true},
		{name: "long password", username: "admin", password: strings.Repeat("x", maxAdminPasswordBytes+1), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := validateBootstrapInput(tt.username, tt.password)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateBootstrapInput() error = %v, wantErr %v", err, tt.wantErr)
			}
			if user != tt.wantUser {
				t.Fatalf("validateBootstrapInput() user = %q, want %q", user, tt.wantUser)
			}
		})
	}
}
