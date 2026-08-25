package reports

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	SchemaVersion             = 2
	MaxRequestBodyBytes       = 2 << 20
	MaxPhotoAttachmentBytes   = 5 << 20
	MaxTextAttachmentBytes    = 5 << 20
	MaxVideoAttachmentBytes   = 15 << 20
	MaxMultipartBodyBytes     = MaxVideoAttachmentBytes + MaxRequestBodyBytes + (512 << 10)
	MaxAttachmentFilenameRune = 255
	MaxBreadcrumbs            = 10
	MaxErrors                 = 3
)

var (
	ErrValidation  = errors.New("invalid problem report")
	stackPosition  = regexp.MustCompile(`:\d+:\d+\)?$`)
	imageMIMETypes = map[string]bool{
		"image/gif":  true,
		"image/heic": true,
		"image/heif": true,
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
	}
	textMIMETypes = map[string]bool{
		"application/json":          true,
		"application/xml":           true,
		"text/csv":                  true,
		"text/markdown":             true,
		"text/plain":                true,
		"text/tab-separated-values": true,
	}
	videoMIMETypes = map[string]bool{
		"video/mp4":        true,
		"video/mpeg":       true,
		"video/quicktime":  true,
		"video/webm":       true,
		"video/x-m4v":      true,
		"video/x-matroska": true,
		"video/x-msvideo":  true,
	}
)

type Request struct {
	SchemaVersion int           `json:"schemaVersion"`
	Description   string        `json:"description"`
	ReportedAt    string        `json:"reportedAt"`
	Page          Page          `json:"page"`
	Browser       Client        `json:"browser"`
	OS            Client        `json:"os"`
	Network       *Network      `json:"network"`
	Breadcrumbs   []Breadcrumb  `json:"breadcrumbs"`
	Errors        []ClientError `json:"errors"`
	Release       Release       `json:"release"`
}

type Page struct {
	Route    string   `json:"route"`
	Viewport Viewport `json:"viewport"`
	Locale   string   `json:"locale"`
	Timezone string   `json:"timezone"`
	Online   bool     `json:"online"`
}

type Viewport struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type Client struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Engine  string `json:"engine,omitempty"`
}

type Network struct {
	Method         string          `json:"method"`
	Endpoint       string          `json:"endpoint"`
	Status         json.RawMessage `json:"status"`
	StatusText     string          `json:"statusText,omitempty"`
	ResponseTimeMS int64           `json:"responseTimeMs"`
	StartedAt      string          `json:"startedAt"`
	RequestID      string          `json:"requestId,omitempty"`
}

type Breadcrumb struct {
	Time           string          `json:"time"`
	Type           string          `json:"type"`
	To             string          `json:"to,omitempty"`
	Target         string          `json:"target,omitempty"`
	Method         string          `json:"method,omitempty"`
	URL            string          `json:"url,omitempty"`
	Status         json.RawMessage `json:"status,omitempty"`
	ResponseTimeMS *int64          `json:"responseTimeMs,omitempty"`
	RequestID      string          `json:"requestId,omitempty"`
}

type ClientError struct {
	Time    string `json:"time"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Stack   string `json:"stack,omitempty"`
	Source  string `json:"source,omitempty"`
	Line    int    `json:"line,omitempty"`
	Column  int    `json:"column,omitempty"`
}

type Release struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

type Diagnostics struct {
	ReportedAt  string        `json:"reportedAt"`
	Page        Page          `json:"page"`
	Browser     Client        `json:"browser"`
	OS          Client        `json:"os"`
	Network     *Network      `json:"network"`
	Breadcrumbs []Breadcrumb  `json:"breadcrumbs"`
	Errors      []ClientError `json:"errors"`
	Release     Release       `json:"release"`
}

type CreateInput struct {
	SchemaVersion   int16
	Description     string
	Diagnostics     []byte
	Fingerprint     string
	ReleaseVersion  string
	CommitSHA       string
	SourceRequestID string
	Attachment      []byte
	AttachmentMIME  string
	AttachmentName  string
	AttachmentSize  int32
}

type AttachmentUpload struct {
	Filename    string
	ContentType string
	Data        []byte
}

type Result struct {
	ReportID    string `json:"reportId"`
	Fingerprint string `json:"fingerprint"`
	ReceivedAt  string `json:"receivedAt"`
}

func Normalize(req Request, sourceRequestID string, attachment *AttachmentUpload) (CreateInput, error) {
	req.Description = strings.TrimSpace(req.Description)
	req.Page.Route = strings.TrimSpace(req.Page.Route)
	req.Browser.Name = strings.TrimSpace(req.Browser.Name)
	req.Browser.Version = strings.TrimSpace(req.Browser.Version)
	req.Browser.Engine = strings.TrimSpace(req.Browser.Engine)
	req.OS.Name = strings.TrimSpace(req.OS.Name)
	req.OS.Version = strings.TrimSpace(req.OS.Version)
	req.Release.Version = strings.TrimSpace(req.Release.Version)
	req.Release.Commit = strings.TrimSpace(req.Release.Commit)

	if req.SchemaVersion != SchemaVersion {
		return CreateInput{}, invalid("schemaVersion must be 2")
	}
	if runeLen(req.Description) < 4 || runeLen(req.Description) > 2000 {
		return CreateInput{}, invalid("description must contain 4 to 2000 characters")
	}
	if req.ReportedAt == "" || len(req.ReportedAt) > 40 {
		return CreateInput{}, invalid("reportedAt is required")
	}
	if _, err := time.Parse(time.RFC3339, req.ReportedAt); err != nil {
		return CreateInput{}, invalid("reportedAt must be ISO 8601")
	}
	if !strings.HasPrefix(req.Page.Route, "/") || len(req.Page.Route) > 512 {
		return CreateInput{}, invalid("page.route must be an application route")
	}
	if req.Page.Viewport.Width <= 0 || req.Page.Viewport.Height <= 0 || req.Page.Viewport.Width > 32768 || req.Page.Viewport.Height > 32768 {
		return CreateInput{}, invalid("page.viewport is invalid")
	}
	if err := validateString("page.locale", req.Page.Locale, 32, true); err != nil {
		return CreateInput{}, err
	}
	if err := validateString("page.timezone", req.Page.Timezone, 100, true); err != nil {
		return CreateInput{}, err
	}
	if err := validateClient("browser", req.Browser, true); err != nil {
		return CreateInput{}, err
	}
	if err := validateClient("os", req.OS, false); err != nil {
		return CreateInput{}, err
	}
	if err := validateString("release.version", req.Release.Version, 100, true); err != nil {
		return CreateInput{}, err
	}
	if err := validateString("release.commit", req.Release.Commit, 64, true); err != nil {
		return CreateInput{}, err
	}
	if len(sourceRequestID) == 0 || len(sourceRequestID) > 200 {
		return CreateInput{}, invalid("request id is invalid")
	}
	if len(req.Breadcrumbs) > MaxBreadcrumbs {
		return CreateInput{}, invalid("breadcrumbs must contain at most 10 entries")
	}
	for i := range req.Breadcrumbs {
		if err := validateBreadcrumb(req.Breadcrumbs[i]); err != nil {
			return CreateInput{}, invalid(fmt.Sprintf("breadcrumbs[%d]: %s", i, err))
		}
	}
	if len(req.Errors) > MaxErrors {
		return CreateInput{}, invalid("errors must contain at most 3 entries")
	}
	for i := range req.Errors {
		if err := validateError(req.Errors[i]); err != nil {
			return CreateInput{}, invalid(fmt.Sprintf("errors[%d]: %s", i, err))
		}
	}
	if req.Network != nil {
		if err := validateNetwork(*req.Network); err != nil {
			return CreateInput{}, err
		}
	}

	attachmentData, attachmentMIME, attachmentName, attachmentSize, err := normalizeAttachment(attachment)
	if err != nil {
		return CreateInput{}, err
	}

	diagnostics, err := json.Marshal(Diagnostics{
		ReportedAt: req.ReportedAt, Page: req.Page, Browser: req.Browser, OS: req.OS,
		Network: req.Network, Breadcrumbs: req.Breadcrumbs, Errors: req.Errors, Release: req.Release,
	})
	if err != nil {
		return CreateInput{}, fmt.Errorf("marshal diagnostics: %w", err)
	}

	return CreateInput{
		SchemaVersion: int16(req.SchemaVersion), Description: req.Description,
		Diagnostics: diagnostics, Fingerprint: Fingerprint(req),
		ReleaseVersion: req.Release.Version, CommitSHA: req.Release.Commit,
		SourceRequestID: sourceRequestID, Attachment: attachmentData, AttachmentMIME: attachmentMIME,
		AttachmentName: attachmentName, AttachmentSize: attachmentSize,
	}, nil
}

func Fingerprint(req Request) string {
	parts := []string{"problem-report", strings.TrimSpace(req.Page.Route)}
	if len(req.Errors) > 0 {
		err := req.Errors[len(req.Errors)-1]
		parts = []string{strings.ToLower(strings.TrimSpace(err.Type)), strings.ToLower(strings.TrimSpace(err.Message))}
		lines := strings.Split(err.Stack, "\n")
		for i, line := range lines {
			if i >= 6 {
				break
			}
			line = stackPosition.ReplaceAllString(strings.TrimSpace(line), "")
			if line != "" {
				parts = append(parts, line)
			}
		}
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return hex.EncodeToString(sum[:])
}

func normalizeAttachment(value *AttachmentUpload) ([]byte, string, string, int32, error) {
	if value == nil {
		return nil, "", "", 0, nil
	}
	if len(value.Data) == 0 {
		return nil, "", "", 0, invalid("attachment is empty")
	}
	if len(value.Data) > MaxVideoAttachmentBytes {
		return nil, "", "", 0, invalid("attachment is too large")
	}

	name := cleanAttachmentFilename(value.Filename)
	mime := attachmentMIME(value.ContentType, value.Data, name)
	if mime == "" {
		return nil, "", "", 0, invalid("attachment type is not supported")
	}

	switch {
	case imageMIMETypes[mime]:
		if len(value.Data) > MaxPhotoAttachmentBytes {
			return nil, "", "", 0, invalid("photo attachment must be 5 MB or less")
		}
	case textMIMETypes[mime] || strings.HasPrefix(mime, "text/"):
		if len(value.Data) > MaxTextAttachmentBytes {
			return nil, "", "", 0, invalid("text attachment must be 5 MB or less")
		}
		if !utf8.Valid(value.Data) || strings.ContainsRune(string(value.Data), '\x00') {
			return nil, "", "", 0, invalid("text attachment must be valid UTF-8")
		}
	case videoMIMETypes[mime]:
		if len(value.Data) > MaxVideoAttachmentBytes {
			return nil, "", "", 0, invalid("video attachment must be 15 MB or less")
		}
	default:
		return nil, "", "", 0, invalid("attachment type is not supported")
	}

	return value.Data, mime, name, int32(len(value.Data)), nil
}

func attachmentMIME(contentType string, data []byte, filename string) string {
	declared := baseMIME(contentType)
	detected := baseMIME(http.DetectContentType(data))
	ext := strings.ToLower(filepath.Ext(filename))

	if imageMIMETypes[detected] {
		return detected
	}
	if imageMIMETypes[declared] && imageExtensionMatches(ext, declared) {
		return declared
	}
	if textMIMETypes[declared] || strings.HasPrefix(declared, "text/") {
		return declared
	}
	if textMIMETypes[detected] || strings.HasPrefix(detected, "text/") {
		return detected
	}
	if videoMIMETypes[detected] {
		return detected
	}
	if videoMIMETypes[declared] && videoExtensionMatches(ext) {
		return declared
	}
	return ""
}

func baseMIME(value string) string {
	base, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(value)), ";")
	return strings.TrimSpace(base)
}

func cleanAttachmentFilename(value string) string {
	name := filepath.Base(strings.ReplaceAll(strings.TrimSpace(value), "\\", "/"))
	if name == "." || name == "/" || name == "" {
		return "attachment"
	}
	if utf8.RuneCountInString(name) <= MaxAttachmentFilenameRune {
		return name
	}
	runes := []rune(name)
	return string(runes[:MaxAttachmentFilenameRune])
}

func imageExtensionMatches(ext string, mime string) bool {
	switch mime {
	case "image/jpeg":
		return ext == ".jpg" || ext == ".jpeg"
	case "image/png":
		return ext == ".png"
	case "image/gif":
		return ext == ".gif"
	case "image/webp":
		return ext == ".webp"
	case "image/heic":
		return ext == ".heic"
	case "image/heif":
		return ext == ".heif"
	default:
		return false
	}
}

func videoExtensionMatches(ext string) bool {
	switch ext {
	case ".avi", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm":
		return true
	default:
		return false
	}
}

func validateClient(field string, client Client, requireEngine bool) error {
	if err := validateString(field+".name", client.Name, 80, true); err != nil {
		return err
	}
	if err := validateString(field+".version", client.Version, 80, false); err != nil {
		return err
	}
	return validateString(field+".engine", client.Engine, 80, requireEngine)
}

func validateNetwork(value Network) error {
	if err := validateString("network.method", value.Method, 16, true); err != nil {
		return err
	}
	if !strings.HasPrefix(value.Endpoint, "/") || len(value.Endpoint) > 512 {
		return invalid("network.endpoint is invalid")
	}
	if err := validateStatus(value.Status); err != nil {
		return invalid("network.status is invalid")
	}
	if value.ResponseTimeMS < 0 || value.ResponseTimeMS > 3_600_000 {
		return invalid("network.responseTimeMs is invalid")
	}
	if err := validateString("network.requestId", value.RequestID, 200, false); err != nil {
		return err
	}
	if _, err := time.Parse(time.RFC3339, value.StartedAt); err != nil {
		return invalid("network.startedAt must be ISO 8601")
	}
	return nil
}

func validateBreadcrumb(value Breadcrumb) error {
	if len(value.Time) == 0 || len(value.Time) > 32 {
		return errors.New("time is invalid")
	}
	switch value.Type {
	case "navigation":
		if !strings.HasPrefix(value.To, "/") || len(value.To) > 512 {
			return errors.New("navigation target is invalid")
		}
	case "click":
		if len(value.Target) == 0 || len(value.Target) > 140 {
			return errors.New("click target is invalid")
		}
	case "network":
		if len(value.Method) == 0 || len(value.Method) > 16 || !strings.HasPrefix(value.URL, "/") || len(value.URL) > 512 {
			return errors.New("network breadcrumb is invalid")
		}
		if err := validateStatus(value.Status); err != nil {
			return errors.New("network status is invalid")
		}
	default:
		return errors.New("type is invalid")
	}
	return nil
}

func validateError(value ClientError) error {
	if value.Type != "error" && value.Type != "unhandledrejection" {
		return errors.New("type is invalid")
	}
	if len(value.Time) == 0 || len(value.Time) > 40 {
		return errors.New("time is invalid")
	}
	if len(strings.TrimSpace(value.Message)) == 0 || runeLen(value.Message) > 500 {
		return errors.New("message is invalid")
	}
	if len(value.Stack) > 2000 || len(value.Source) > 512 {
		return errors.New("stack or source is too large")
	}
	return nil
}

func validateStatus(raw json.RawMessage) error {
	if len(raw) == 0 {
		return errors.New("missing status")
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch status := value.(type) {
	case float64:
		if status < 100 || status > 599 || status != float64(int(status)) {
			return errors.New("invalid HTTP status")
		}
	case string:
		if status != "pending" && status != "network_error" && status != "aborted" {
			return errors.New("invalid status")
		}
	default:
		return errors.New("invalid status type")
	}
	return nil
}

func validateString(field, value string, maxLen int, required bool) error {
	if required && strings.TrimSpace(value) == "" {
		return invalid(field + " is required")
	}
	if utf8.RuneCountInString(value) > maxLen {
		return invalid(field + " is too long")
	}
	return nil
}

func runeLen(value string) int { return utf8.RuneCountInString(value) }

func invalid(message string) error { return fmt.Errorf("%w: %s", ErrValidation, message) }
