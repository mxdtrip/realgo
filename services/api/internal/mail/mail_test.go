package mail

import (
	"bufio"
	"context"
	"mime"
	"net"
	stdmail "net/mail"
	"strings"
	"testing"
	"time"
)

func TestConfigAllowsSeparateSMTPLoginAndDomainSender(t *testing.T) {
	err := (Config{
		Enabled:  true,
		Host:     "mail.smtp2go.com",
		Port:     2525,
		Username: "realgo-transactional",
		Password: "test-only",
		BaseURL:  "https://realgo.dev",
		Timeout:  10 * time.Second,
	}).Validate()
	if err != nil {
		t.Fatalf("Validate() error = %v, want nil", err)
	}
}

func TestConfigRejectsEmptySMTPLogin(t *testing.T) {
	err := (Config{
		Enabled:  true,
		Host:     "mail.smtp2go.com",
		Port:     2525,
		Password: "test-only",
		BaseURL:  "https://realgo.dev",
		Timeout:  10 * time.Second,
	}).Validate()
	if err == nil || !strings.Contains(err.Error(), "MAIL_SMTP_USERNAME") {
		t.Fatalf("Validate() error = %v, want a username error", err)
	}
}

func TestConfigAllowsInternalPlainSMTPRelay(t *testing.T) {
	err := (Config{
		Enabled: true,
		Host:    "mail-relay",
		Port:    2526,
		BaseURL: "https://realgo.dev",
		Timeout: 10 * time.Second,
		TLSMode: "none",
	}).Validate()
	if err != nil {
		t.Fatalf("Validate() error = %v, want nil", err)
	}
}

func TestConfigRejectsAutoTLSOnCustomPort(t *testing.T) {
	err := (Config{
		Enabled: true,
		Host:    "mail-relay",
		Port:    2526,
		BaseURL: "https://realgo.dev",
		Timeout: 10 * time.Second,
	}).Validate()
	if err == nil || !strings.Contains(err.Error(), "MAIL_SMTP_TLS_MODE=auto") {
		t.Fatalf("Validate() error = %v, want an auto TLS mode error", err)
	}
}

func TestConfigRejectsPartialSMTPAuth(t *testing.T) {
	err := (Config{
		Enabled:  true,
		Host:     "mail-relay",
		Port:     2526,
		Username: "support@realgo.dev",
		BaseURL:  "https://realgo.dev",
		Timeout:  10 * time.Second,
		TLSMode:  "none",
	}).Validate()
	if err == nil || !strings.Contains(err.Error(), "MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD") {
		t.Fatalf("Validate() error = %v, want a partial auth error", err)
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
	for _, want := range []string{"test-token", "действует 30 минут"} {
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
	parsed, err := stdmail.ReadMessage(strings.NewReader(formatted))
	if err != nil {
		t.Fatal(err)
	}
	from, err := stdmail.ParseAddress(parsed.Header.Get("From"))
	if err != nil || from.Name != "ReAlgo" || from.Address != SenderAddress {
		t.Fatalf("From header = %q, want ReAlgo <%s>", parsed.Header.Get("From"), SenderAddress)
	}
	replyTo, err := stdmail.ParseAddress(parsed.Header.Get("Reply-To"))
	if err != nil || replyTo.Address != ReplyToAddress {
		t.Fatalf("Reply-To header = %q, want %s", parsed.Header.Get("Reply-To"), ReplyToAddress)
	}
	if strings.Contains(formatted, "freeburger.team@gmail.com") {
		t.Fatalf("message contains the excluded Gmail sender")
	}
}

func TestSMTPSendToFakeRelayUsesResetHeadersAndBody(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	received := make(chan string, 1)
	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer func() { _ = conn.Close() }()
		reader := bufio.NewReader(conn)
		write := func(value string) { _, _ = conn.Write([]byte(value + "\r\n")) }
		write("220 fake relay")
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				return
			}
			switch {
			case strings.HasPrefix(line, "EHLO "):
				write("250 fake relay")
			case strings.HasPrefix(line, "MAIL FROM:<noreply@realgo.dev>"):
				write("250 sender accepted")
			case strings.HasPrefix(line, "RCPT TO:<recipient@example.com>"):
				write("250 recipient accepted")
			case strings.HasPrefix(line, "DATA"):
				write("354 send message")
				var lines []string
				for {
					bodyLine, bodyErr := reader.ReadString('\n')
					if bodyErr != nil {
						return
					}
					if bodyLine == ".\r\n" {
						received <- strings.Join(lines, "")
						write("250 queued")
						break
					}
					lines = append(lines, bodyLine)
				}
			case strings.HasPrefix(line, "QUIT"):
				write("221 bye")
				return
			default:
				write("500 unexpected command")
			}
		}
	}()

	message, err := RenderPasswordReset(PasswordResetData{
		ExpiresIn: "30",
		ResetURL:  "https://realgo.dev/reset-password?token=reset-token-for-test",
	}, "https://realgo.dev")
	if err != nil {
		t.Fatal(err)
	}
	message.To = "recipient@example.com"
	mailer, err := NewSMTP(Config{
		Enabled: true, Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port,
		BaseURL: "https://realgo.dev", Timeout: 2 * time.Second, TLSMode: "none",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := mailer.Send(context.Background(), message); err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	select {
	case raw := <-received:
		parsed, parseErr := stdmail.ReadMessage(strings.NewReader(raw))
		if parseErr != nil {
			t.Fatal(parseErr)
		}
		from, fromErr := stdmail.ParseAddress(parsed.Header.Get("From"))
		replyTo, replyErr := stdmail.ParseAddress(parsed.Header.Get("Reply-To"))
		to, toErr := stdmail.ParseAddress(parsed.Header.Get("To"))
		subject, subjectErr := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
		if fromErr != nil || from.Name != "ReAlgo" || from.Address != SenderAddress {
			t.Errorf("From header = %q", parsed.Header.Get("From"))
		}
		if replyErr != nil || replyTo.Address != ReplyToAddress {
			t.Errorf("Reply-To header = %q", parsed.Header.Get("Reply-To"))
		}
		if toErr != nil || to.Address != "recipient@example.com" {
			t.Errorf("To header = %q", parsed.Header.Get("To"))
		}
		if subjectErr != nil || subject != "Сброс пароля ReAlgo" {
			t.Errorf("Subject header = %q", parsed.Header.Get("Subject"))
		}
		for _, want := range []string{"https://realgo.dev/reset-password?token=reset-token-for-test", "multipart/alternative"} {
			if !strings.Contains(raw, want) {
				t.Errorf("SMTP message missing %q", want)
			}
		}
	case <-time.After(2 * time.Second):
		t.Fatal("fake SMTP server did not receive a message")
	}
}

func TestDisabledSMTPDoesNotCreateSender(t *testing.T) {
	sender, err := NewSMTP(Config{Enabled: false})
	if err != nil || sender != nil {
		t.Fatalf("NewSMTP(disabled) = (%v, %v), want (nil, nil)", sender, err)
	}
}
