// Package mail contains the ReAlgo transactional mail transport and templates.
// The sender identity is intentionally fixed to the domain mailbox. The SMTP
// account may still differ when a relay such as Gmail is authorized to send as
// support@realgo.dev.
package mail

import (
	"context"
	"crypto/tls"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	texttemplate "text/template"
	"time"
)

const SenderAddress = "support@realgo.dev"
const defaultDisplayName = "ReAlgo"

//go:embed templates/*.html templates/*.txt
var templateFS embed.FS

// Config is loaded from runtime environment variables. Password is never
// logged and is not part of any checked-in configuration file.
type Config struct {
	Enabled  bool
	Host     string
	Port     int
	Username string
	Password string
	BaseURL  string
	Timeout  time.Duration
}

func (c Config) Validate() error {
	if !c.Enabled {
		return nil
	}
	if strings.TrimSpace(c.Host) == "" {
		return errors.New("MAIL_SMTP_HOST must be set when MAIL_ENABLED=true")
	}
	if c.Port != 465 && c.Port != 587 {
		return errors.New("MAIL_SMTP_PORT must be 465 or 587")
	}
	if strings.TrimSpace(c.Username) == "" {
		return errors.New("MAIL_SMTP_USERNAME must be set when MAIL_ENABLED=true")
	}
	if c.Password == "" {
		return errors.New("MAIL_SMTP_PASSWORD must be set when MAIL_ENABLED=true")
	}
	if c.BaseURL == "" {
		return errors.New("MAIL_BASE_URL must be set when MAIL_ENABLED=true")
	}
	if c.Timeout <= 0 {
		return errors.New("MAIL_SMTP_TIMEOUT must be greater than zero")
	}
	return nil
}

// Message is a fully rendered email. Sender is not configurable by callers.
type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

// Sender is the transport used by auth and future notification workers.
type Sender interface {
	Send(context.Context, Message) error
}

type SMTP struct {
	cfg Config
}

func NewSMTP(cfg Config) (*SMTP, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if !cfg.Enabled {
		return nil, nil
	}
	return &SMTP{cfg: cfg}, nil
}

// Send submits one message over authenticated SMTP. Port 587 uses STARTTLS;
// port 465 uses implicit TLS. The fixed sender is also used in the SMTP MAIL
// FROM command, not only in the visible header.
func (s *SMTP) Send(ctx context.Context, message Message) error {
	if s == nil {
		return errors.New("mail sender is disabled")
	}
	to, err := parseAddress(message.To)
	if err != nil {
		return fmt.Errorf("parse recipient: %w", err)
	}
	if strings.TrimSpace(message.Subject) == "" {
		return errors.New("mail subject is empty")
	}

	port := strconv.Itoa(s.cfg.Port)
	address := net.JoinHostPort(s.cfg.Host, port)
	dialer := net.Dialer{Timeout: s.cfg.Timeout}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("dial SMTP: %w", err)
	}
	defer func() { _ = conn.Close() }()
	_ = conn.SetDeadline(time.Now().Add(s.cfg.Timeout))

	if s.cfg.Port == 465 {
		tlsConn := tls.Client(conn, &tls.Config{ServerName: s.cfg.Host, MinVersion: tls.VersionTLS12})
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			return fmt.Errorf("SMTP TLS handshake: %w", err)
		}
		conn = tlsConn
	}

	client, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		return fmt.Errorf("create SMTP client: %w", err)
	}
	defer func() { _ = client.Close() }()

	if s.cfg.Port == 587 {
		if err := client.StartTLS(&tls.Config{ServerName: s.cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("SMTP STARTTLS: %w", err)
		}
	}
	if err := client.Auth(smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)); err != nil {
		return fmt.Errorf("SMTP authentication: %w", err)
	}
	if err := client.Mail(SenderAddress); err != nil {
		return fmt.Errorf("SMTP MAIL FROM: %w", err)
	}
	if err := client.Rcpt(to.Address); err != nil {
		return fmt.Errorf("SMTP RCPT TO: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}
	if _, err := io.WriteString(w, formatMessage(to, message)); err != nil {
		_ = w.Close()
		return fmt.Errorf("write SMTP message: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("finish SMTP message: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("close SMTP session: %w", err)
	}
	return nil
}

func parseAddress(raw string) (*mail.Address, error) {
	raw = strings.TrimSpace(raw)
	address, err := mail.ParseAddress(raw)
	if err != nil || address.Address != raw || strings.ContainsAny(raw, "\r\n") {
		return nil, errors.New("recipient must be one plain email address")
	}
	return address, nil
}

func formatMessage(to *mail.Address, message Message) string {
	boundary := fmt.Sprintf("realgo-%d", time.Now().UnixNano())
	from := (&mail.Address{Name: defaultDisplayName, Address: SenderAddress}).String()
	toHeader := to.String()
	return strings.Join([]string{
		"Date: " + time.Now().UTC().Format(time.RFC1123Z),
		"From: " + from,
		"To: " + toHeader,
		"Reply-To: " + SenderAddress,
		"Subject: " + mime.QEncoding.Encode("UTF-8", message.Subject),
		"MIME-Version: 1.0",
		"Content-Type: multipart/alternative; boundary=\"" + boundary + "\"",
		"",
		"--" + boundary,
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		normalizeCRLF(message.Text),
		"--" + boundary,
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		normalizeCRLF(message.HTML),
		"--" + boundary + "--",
		"",
	}, "\r\n")
}

func normalizeCRLF(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\n", "\r\n")
}

type PasswordResetData struct {
	Email       string
	ExpiresIn   string
	ResetURL    string
	ChangedAt   string
	Device      string
	Region      string
	RecoveryURL string
}

// RenderPasswordReset renders the prepared ReAlgo security template and its
// mandatory plain-text alternative.
func RenderPasswordReset(data PasswordResetData, baseURL string) (Message, error) {
	values := map[string]string{
		"Email": data.Email, "ExpiresIn": data.ExpiresIn, "ResetURL": data.ResetURL,
		"SettingsURL": strings.TrimRight(baseURL, "/") + "/settings",
		"SupportURL":  strings.TrimRight(baseURL, "/") + "/support",
	}
	return renderTemplate("password-reset", "Ссылка для смены пароля ReAlgo", values)
}

// RenderPasswordChanged renders the prepared ReAlgo security template.
func RenderPasswordChanged(data PasswordResetData, baseURL string) (Message, error) {
	values := map[string]string{
		"Email": data.Email, "ChangedAt": data.ChangedAt, "Device": data.Device,
		"Region": data.Region, "RecoveryURL": data.RecoveryURL,
		"SettingsURL": strings.TrimRight(baseURL, "/") + "/settings",
		"SupportURL":  strings.TrimRight(baseURL, "/") + "/support",
	}
	return renderTemplate("password-changed", "Пароль ReAlgo изменён", values)
}

func renderTemplate(name, subject string, values map[string]string) (Message, error) {
	htmlTemplates, err := template.New("emails").ParseFS(templateFS, "templates/*.html")
	if err != nil {
		return Message{}, fmt.Errorf("parse HTML email templates: %w", err)
	}
	textTemplates, err := texttemplate.New("emails").ParseFS(templateFS, "templates/*.txt")
	if err != nil {
		return Message{}, fmt.Errorf("parse text email templates: %w", err)
	}
	var htmlBody, textBody strings.Builder
	if err := htmlTemplates.ExecuteTemplate(&htmlBody, name+".html", values); err != nil {
		return Message{}, fmt.Errorf("render HTML %s: %w", name, err)
	}
	if err := textTemplates.ExecuteTemplate(&textBody, name+".txt", values); err != nil {
		return Message{}, fmt.Errorf("render text %s: %w", name, err)
	}
	return Message{Subject: subject, Text: textBody.String(), HTML: htmlBody.String()}, nil
}
