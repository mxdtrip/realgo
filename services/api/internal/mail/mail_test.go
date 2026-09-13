package mail

import (
	stdmail "net/mail"
	"strings"
	"testing"
)

func TestPasswordResetMessageHasRequiredIdentityAndContent(t *testing.T) {
	message := PasswordReset("https://test.realgo.dev/reset-password?token=opaque", 30)
	to, err := stdmail.ParseAddress("user@example.com")
	if err != nil {
		t.Fatal(err)
	}
	raw := format(to, message)
	for _, want := range []string{"From: ReAlgo <noreply@realgo.dev>", "Reply-To: support@realgo.dev", "https://test.realgo.dev/reset-password?token=opaque", "multipart/alternative"} {
		if !strings.Contains(raw, want) {
			t.Fatalf("message missing %q", want)
		}
	}
}

func TestEmailVerificationIncludesSixDigitCode(t *testing.T) {
	message := EmailVerification("004281", 10)
	if message.Subject != "Код подтверждения ReAlgo" || !strings.Contains(message.Text, "004281") || !strings.Contains(message.HTML, "004281") {
		t.Fatal("verification message must contain the exact code")
	}
}
