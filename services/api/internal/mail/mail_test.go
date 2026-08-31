package mail

import (
	"strings"
	"testing"
	"time"
)

func TestConfigRejectsNonDomainSenderAccount(t *testing.T) {
	err := (Config{
		Enabled:  true,
		Host:     "mail.realgo.dev",
		Port:     587,
		Username: "freeburger.team@gmail.com",
		Password: "test-only",
		BaseURL:  "https://realgo.dev",
		Timeout:  10 * time.Second,
	}).Validate()
	if err == nil || !strings.Contains(err.Error(), SenderAddress) {
		t.Fatalf("Validate() error = %v, want a domain-sender error", err)
	}
}

func TestRenderPasswordResetUsesPreparedTemplates(t *testing.T) {
	message, err := RenderPasswordReset(PasswordResetData{
		Email:     "user@example.com",
		ExpiresIn: "30",
		ResetURL:  "https://realgo.dev/reset-password?token=test-token",
	}, "https://realgo.dev")
	if err != nil {
		t.Fatalf("RenderPasswordReset() error = %v", err)
	}
	for _, want := range []string{"user@example.com", "test-token"} {
		if !strings.Contains(message.HTML+message.Text, want) {
			t.Fatalf("rendered message does not contain %q", want)
		}
	}
	if strings.Contains(message.HTML+message.Text, "{{.") {
		t.Fatalf("rendered message contains unresolved template variables")
	}
}

func TestFormatMessageUsesOnlyDomainSender(t *testing.T) {
	to, err := parseAddress("recipient@example.com")
	if err != nil {
		t.Fatal(err)
	}
	formatted := formatMessage(to, Message{Subject: "Пароль изменён", Text: "text", HTML: "<p>html</p>"})
	if !strings.Contains(formatted, "support@realgo.dev") {
		t.Fatalf("message does not contain domain sender")
	}
	if strings.Contains(formatted, "freeburger.team@gmail.com") {
		t.Fatalf("message contains the excluded Gmail sender")
	}
}

func TestDisabledSMTPDoesNotCreateSender(t *testing.T) {
	sender, err := NewSMTP(Config{Enabled: false})
	if err != nil || sender != nil {
		t.Fatalf("NewSMTP(disabled) = (%v, %v), want (nil, nil)", sender, err)
	}
}
