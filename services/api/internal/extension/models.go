package extension

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/mxdtrip/realgo/services/api/internal/scheduler"
)

// Event types accepted from the extension. Only EventProblemSolved drives the
// progress + review-schedule flow; the rest are recorded for the activity feed.
const (
	EventProblemSolved    = "problem_solved"
	EventProblemSubmitted = "problem_submitted"
	EventProblemViewed    = "problem_viewed"
	EventRatingChanged    = "rating_changed"
	EventSyncDisabled     = "sync_disabled"
)

// EventRequest is the POST /api/v1/extension/events payload.
// EventRequest documents the ExtensionEventRequest JSON shape.
//
// Поддерживаются исходный event/problem payload и submit payload. source имеет приоритет над platform; problem.* над task*. Для известных платформ нужен HTTPS URL на домене выбранной платформы. occurredAt/submittedAt по умолчанию равен серверному времени. Для problem_solved нужна оценка hard/normal/easy. Для submit payload eventId вычисляется автоматически.
//
// Example: {"platform":"leetcode","taskTitle":"Two Sum","taskUrl":"https://leetcode.com/problems/two-sum/","platformTaskSlug":"two-sum","submitResult":"accepted","submittedAt":"2026-10-05T16:00:00Z","userDifficulty":"normal","canSolveAgain":"probably"}
//
// swagger:model ExtensionEventRequest
// swagger:additionalProperties false
type EventRequest struct {
	// Required: false
	EventID string `json:"eventId"`
	// Код платформы; unknown нормализуется в generic. Если платформа отсутствует в БД, возвращается 422 UNKNOWN_PLATFORM.
	//
	// Required: false
	Source string `json:"source"` // platform code, e.g. "leetcode"
	// see Event* constants
	//
	// Required: false
	// Enum: ["", "problem_solved", "problem_submitted", "problem_viewed", "rating_changed", "sync_disabled"]
	Event string `json:"event"` // see Event* constants
	// RFC3339; отсутствие или пустая строка запускает fallback к другому полю либо серверному времени.
	//
	// Required: false
	OccurredAt string `json:"occurredAt"`
	// hard | normal | easy (problem_solved)
	//
	// Required: false
	// Enum: ["", "hard", "normal", "easy"]
	Rating string `json:"rating"` // hard | normal | easy (problem_solved)
	// Required: false
	ExtensionVersion string `json:"extensionVersion"`
	// Required: false
	Problem EventProblem `json:"problem"`

	// Current extension payload. Kept alongside the original event/problem
	// shape so older clients do not break while the browser extension sends the
	// lighter submit-focused contract.
	// Fallback для source. Обычные значения: leetcode, hackerrank, geeksforgeeks, codeforces.
	//
	// Required: false
	Platform string `json:"platform"`
	// Required: false
	TaskTitle string `json:"taskTitle"`
	// Required: false
	TaskURL string `json:"taskUrl"`
	// Required: false
	PlatformTaskSlug string `json:"platformTaskSlug"`
	// accepted без явного event преобразуется в problem_solved; остальные значения — в problem_submitted.
	//
	// Required: false
	SubmitResult string `json:"submitResult"`
	// RFC3339; отсутствие или пустая строка запускает fallback к другому полю либо серверному времени.
	//
	// Required: false
	SubmittedAt string `json:"submittedAt"`
	// Required: false
	// Enum: ["", "hard", "normal", "easy"]
	UserDifficulty string `json:"userDifficulty"`
	// Принимается для совместимости; участвует в автоматически вычисляемом ключе события.
	//
	// Required: false
	CanSolveAgain string `json:"canSolveAgain"`
}

// EventProblem is the task the event refers to.
// EventProblem documents the ExtensionEventProblem JSON shape.
//
// swagger:model ExtensionEventProblem
// swagger:additionalProperties false
type EventProblem struct {
	// Required: false
	ExternalID string `json:"externalId"`
	// Required: false
	Title string `json:"title"`
	// Required: false
	URL string `json:"url"`
	// easy, medium или hard. Неизвестное значение очищается, запрос не отклоняется.
	//
	// Required: false
	Difficulty string `json:"difficulty"` // optional: easy | medium | hard
	// optional, unused in MVP
	//
	// Required: false
	PatternName string `json:"patternName"` // optional, unused in MVP
}

// EventResult is the response payload (problem_id, status, next_review_at per
// the issue's acceptance criteria, plus idempotency signal).
// EventResult documents the ExtensionEventResult JSON shape.
//
// swagger:model ExtensionEventResult
type EventResult struct {
	// Required: true
	Accepted bool `json:"accepted"`
	// Required: true
	Duplicate bool `json:"duplicate"`
	// Required: true
	ProblemID int64 `json:"problemId"`
	// Required: false
	ReviewID int64 `json:"reviewId,omitempty"`
	// Required: true
	Status string `json:"status"`
	// swagger:name nextReviewAt
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"nextReviewAt"`
}

// normalized is the validated, lower-cased view of an EventRequest.
type normalized struct {
	eventID    string
	platform   string
	event      string
	slug       string
	title      string
	url        string
	difficulty string
	rating     scheduler.Rating
	solved     bool
	occurredAt time.Time
}

var validEventTypes = map[string]bool{
	EventProblemSolved:    true,
	EventProblemSubmitted: true,
	EventProblemViewed:    true,
	EventRatingChanged:    true,
	EventSyncDisabled:     true,
}

var validDifficulty = map[string]bool{
	"easy":   true,
	"medium": true,
	"hard":   true,
}

// normalize validates the request and lower-cases platform + slug. The provided
// now is used when occurredAt is absent.
func (r EventRequest) normalize(now time.Time) (normalized, error) {
	currentPayload := r.hasSubmissionPayload()
	occurredAtRaw := strings.TrimSpace(r.OccurredAt)
	if occurredAtRaw == "" {
		occurredAtRaw = strings.TrimSpace(r.SubmittedAt)
	}

	out := normalized{
		eventID:    strings.TrimSpace(r.EventID),
		platform:   platformCode(firstNonEmpty(r.Source, r.Platform)),
		event:      strings.ToLower(strings.TrimSpace(r.Event)),
		slug:       strings.ToLower(strings.TrimSpace(firstNonEmpty(r.Problem.ExternalID, r.PlatformTaskSlug))),
		title:      strings.TrimSpace(firstNonEmpty(r.Problem.Title, r.TaskTitle)),
		url:        strings.TrimSpace(firstNonEmpty(r.Problem.URL, r.TaskURL)),
		difficulty: strings.ToLower(strings.TrimSpace(r.Problem.Difficulty)),
	}

	if out.event == "" && currentPayload {
		switch strings.ToLower(strings.TrimSpace(r.SubmitResult)) {
		case "accepted":
			out.event = EventProblemSolved
		default:
			out.event = EventProblemSubmitted
		}
	}

	if out.platform == "" {
		return normalized{}, fmt.Errorf("%w: source is required", ErrValidation)
	}
	if !validEventTypes[out.event] {
		return normalized{}, fmt.Errorf("%w: unsupported event %q", ErrValidation, r.Event)
	}
	if out.slug == "" {
		out.slug = fallbackSlug(out.url, out.title)
	}
	if out.slug == "" {
		return normalized{}, fmt.Errorf("%w: problem.externalId is required", ErrValidation)
	}
	if out.url == "" {
		return normalized{}, fmt.Errorf("%w: problem.url is required", ErrValidation)
	}
	if !validProblemURL(out.platform, out.url) {
		return normalized{}, fmt.Errorf("%w: problem.url must be an HTTPS URL on the selected platform", ErrValidation)
	}
	if out.title == "" {
		out.title = out.slug
	}
	// problems.difficulty is constrained to easy|medium|hard; drop anything else
	// so the upsert stores NULL rather than violating the CHECK.
	if !validDifficulty[out.difficulty] {
		out.difficulty = ""
	}

	ratingRaw := strings.ToLower(strings.TrimSpace(firstNonEmpty(r.Rating, r.UserDifficulty)))
	if ratingRaw != "" {
		rating := scheduler.Rating(ratingRaw)
		if !validRating(rating) {
			return normalized{}, fmt.Errorf("%w: rating must be hard, normal or easy", ErrValidation)
		}
		out.rating = rating
	}

	out.solved = out.event == EventProblemSolved
	if out.solved && out.rating == "" {
		return normalized{}, fmt.Errorf("%w: rating must be hard, normal or easy for %s", ErrValidation, EventProblemSolved)
	}

	if occurredAtRaw == "" {
		out.occurredAt = now
	} else {
		ts, err := time.Parse(time.RFC3339, occurredAtRaw)
		if err != nil {
			return normalized{}, fmt.Errorf("%w: occurredAt must be ISO 8601", ErrValidation)
		}
		out.occurredAt = ts
	}

	if out.eventID == "" && currentPayload {
		out.eventID = generatedEventID(out, r)
	}
	if out.eventID == "" {
		return normalized{}, fmt.Errorf("%w: eventId is required", ErrValidation)
	}

	return out, nil
}

func (r EventRequest) hasSubmissionPayload() bool {
	return strings.TrimSpace(r.Platform) != "" ||
		strings.TrimSpace(r.TaskTitle) != "" ||
		strings.TrimSpace(r.TaskURL) != "" ||
		strings.TrimSpace(r.PlatformTaskSlug) != "" ||
		strings.TrimSpace(r.SubmittedAt) != "" ||
		strings.TrimSpace(r.UserDifficulty) != "" ||
		strings.TrimSpace(r.CanSolveAgain) != ""
}

func platformCode(value string) string {
	code := strings.ToLower(strings.TrimSpace(value))
	if code == "unknown" {
		return "generic"
	}
	return code
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func validRating(rating scheduler.Rating) bool {
	switch rating {
	case scheduler.RatingHard, scheduler.RatingNormal, scheduler.RatingEasy:
		return true
	default:
		return false
	}
}

func validHTTPURL(value string) bool {
	parsed, err := url.ParseRequestURI(value)
	return err == nil && parsed.Host != "" && parsed.User == nil && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func validProblemURL(platform, value string) bool {
	if !validHTTPURL(value) {
		return false
	}
	parsed, _ := url.ParseRequestURI(value)
	host := strings.ToLower(parsed.Hostname())
	allowedHost := func(root string) bool {
		return host == root || strings.HasSuffix(host, "."+root)
	}

	switch platform {
	case "leetcode":
		return parsed.Scheme == "https" && allowedHost("leetcode.com")
	case "hackerrank":
		return parsed.Scheme == "https" && allowedHost("hackerrank.com")
	case "geeksforgeeks":
		return parsed.Scheme == "https" && allowedHost("geeksforgeeks.org")
	case "codeforces":
		return parsed.Scheme == "https" && allowedHost("codeforces.com")
	default:
		// Backward-compatible generic/custom events may point to another coding
		// platform. Known platforms above are deliberately strict.
		return true
	}
}

func fallbackSlug(rawURL, title string) string {
	if parsed, err := url.Parse(rawURL); err == nil {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) > 0 && parts[len(parts)-1] != "" {
			return strings.ToLower(parts[len(parts)-1])
		}
	}
	if title == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(rawURL + "\x00" + title))
	return "extension-" + hex.EncodeToString(sum[:8])
}

func generatedEventID(n normalized, r EventRequest) string {
	h := sha256.New()
	for _, part := range []string{
		n.platform,
		n.event,
		n.slug,
		n.url,
		n.occurredAt.UTC().Format(time.RFC3339Nano),
		strings.ToLower(strings.TrimSpace(r.SubmitResult)),
		strings.ToLower(strings.TrimSpace(r.UserDifficulty)),
		strings.ToLower(strings.TrimSpace(r.CanSolveAgain)),
	} {
		h.Write([]byte(part))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}
