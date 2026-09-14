// Package mail provides the small transactional SMTP surface used by auth.
// Credentials only live at runtime; the visible sender is deliberately fixed.
package mail

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
	"net"
	stdmail "net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

const SenderAddress = "noreply@realgo.dev"
const ReplyToAddress = "support@realgo.dev"

type Config struct {
	Enabled  bool
	Host     string
	Port     int
	Username string
	Password string
	BaseURL  string
	Timeout  time.Duration
	TLSMode  string
}

type Message struct{ To, Subject, Text, HTML string }
type Sender interface {
	Send(context.Context, Message) error
}
type SMTP struct{ cfg Config }

func NewSMTP(cfg Config) (*SMTP, error) {
	if !cfg.Enabled {
		return nil, nil
	}
	if cfg.Host == "" || cfg.Port < 1 || cfg.Port > 65535 || cfg.BaseURL == "" || cfg.Timeout <= 0 {
		return nil, errors.New("invalid transactional mail configuration")
	}
	if (cfg.Username == "") != (cfg.Password == "") {
		return nil, errors.New("MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD must be set together")
	}
	if _, err := tlsMode(cfg.TLSMode, cfg.Port); err != nil {
		return nil, err
	}
	return &SMTP{cfg: cfg}, nil
}

func tlsMode(value string, port int) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(value))
	if mode == "" || mode == "auto" {
		if port == 465 {
			return "implicit", nil
		}
		if port == 587 || port == 2525 {
			return "starttls", nil
		}
		return "", errors.New("unsupported SMTP auto TLS port")
	}
	if mode != "none" && mode != "starttls" && mode != "implicit" {
		return "", errors.New("MAIL_SMTP_TLS_MODE must be none, starttls, or implicit")
	}
	return mode, nil
}

func (s *SMTP) Send(ctx context.Context, msg Message) error {
	if s == nil {
		return errors.New("mailer disabled")
	}
	to, err := stdmail.ParseAddress(strings.TrimSpace(msg.To))
	if err != nil || to.Address != strings.TrimSpace(msg.To) || strings.ContainsAny(msg.To, "\r\n") {
		return errors.New("invalid recipient")
	}
	if strings.TrimSpace(msg.Subject) == "" {
		return errors.New("empty message subject")
	}
	mode, err := tlsMode(s.cfg.TLSMode, s.cfg.Port)
	if err != nil {
		return err
	}
	conn, err := (&net.Dialer{Timeout: s.cfg.Timeout}).DialContext(ctx, "tcp", net.JoinHostPort(s.cfg.Host, strconv.Itoa(s.cfg.Port)))
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer func() { _ = conn.Close() }()
	_ = conn.SetDeadline(time.Now().Add(s.cfg.Timeout))
	if mode == "implicit" {
		secure := tls.Client(conn, &tls.Config{ServerName: s.cfg.Host, MinVersion: tls.VersionTLS12})
		if err := secure.HandshakeContext(ctx); err != nil {
			return fmt.Errorf("smtp tls: %w", err)
		}
		conn = secure
	}
	client, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer func() { _ = client.Close() }()
	if mode == "starttls" {
		if err := client.StartTLS(&tls.Config{ServerName: s.cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}
	if s.cfg.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)); err != nil {
			return fmt.Errorf("smtp authentication: %w", err)
		}
	}
	if err := client.Mail(SenderAddress); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to.Address); err != nil {
		return fmt.Errorf("smtp recipient: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err = io.WriteString(w, format(to, msg)); err != nil {
		_ = w.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("smtp complete: %w", err)
	}
	_ = client.Quit()
	return nil
}

func format(to *stdmail.Address, msg Message) string {
	boundary := fmt.Sprintf("realgo-%d", time.Now().UnixNano())
	from := "ReAlgo <" + SenderAddress + ">"
	return strings.Join([]string{"Date: " + time.Now().UTC().Format(time.RFC1123Z), "From: " + from, "To: " + to.String(), "Reply-To: " + ReplyToAddress, "Subject: " + mime.QEncoding.Encode("UTF-8", msg.Subject), "MIME-Version: 1.0", "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"", "", "--" + boundary, "Content-Type: text/plain; charset=UTF-8", "", crlf(msg.Text), "--" + boundary, "Content-Type: text/html; charset=UTF-8", "", crlf(msg.HTML), "--" + boundary + "--", ""}, "\r\n")
}
func crlf(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\n", "\r\n")
}

func PasswordReset(resetURL string, minutes int) Message {
	text := fmt.Sprintf("Сброс пароля ReAlgo\n\nОткройте ссылку, чтобы установить новый пароль:\n%s\n\nСсылка действует %d минут. Если вы не запрашивали сброс, проигнорируйте это письмо.", resetURL, minutes)
	htmlBody := fmt.Sprintf("<p>Запрошен сброс пароля ReAlgo.</p><p><a href=\"%s\">Установить новый пароль</a></p><p>Ссылка действует %d минут. Если это были не вы, просто проигнорируйте письмо.</p>", html.EscapeString(resetURL), minutes)
	return Message{Subject: "Сброс пароля ReAlgo", Text: text, HTML: htmlBody}
}

func EmailVerification(code string, minutes int) Message {
	text := fmt.Sprintf("Подтверждение email ReAlgo\n\nВведите на сайте код: %s\n\nКод действует %d минут. Если вы не создавали аккаунт, проигнорируйте это письмо.", code, minutes)
	htmlBody := fmt.Sprintf("<p>Подтвердите email в ReAlgo.</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:6px\">%s</p><p>Введите код на сайте. Он действует %d минут. Если это были не вы, проигнорируйте письмо.</p>", html.EscapeString(code), minutes)
	return Message{Subject: "Код подтверждения ReAlgo", Text: text, HTML: htmlBody}
}
