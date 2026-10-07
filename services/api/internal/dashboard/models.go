package dashboard

import "time"

const (
	nextActionTypeCardSession   = "card_session"
	nextActionTypeProblemReview = "problem_review"
	nextActionTypePatternReview = "pattern_review"
	nextActionTypeRoadmapStep   = "roadmap_step"

	reviewPreviewTypeCard    = "card_review"
	reviewPreviewTypeProblem = "problem_review"
	reviewPreviewTypePattern = "pattern_review"

	statToneDefault = "default"
	statToneAccent  = "accent"
	statToneSuccess = "success"
	statToneWarning = "warning"
	statToneDanger  = "danger"
)

// Response documents the DashboardResponse JSON shape.
//
// swagger:model DashboardResponse
type Response struct {
	// Required: true
	NextAction NextAction `json:"nextAction"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Stats []Stat `json:"stats"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ReviewPreview []ReviewPreviewItem `json:"reviewPreview"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	WeakPatterns []WeakPattern `json:"weakPatterns"`
	// Required: true
	Activity Activity `json:"activity"`
}

// Activity feeds the dashboard heatmap: per-day counts over the last
// activityWindowDays days (user timezone), oldest first. Days with no
// activity are omitted from Days.
// Activity documents the DashboardActivity JSON shape.
//
// swagger:model DashboardActivity
type Activity struct {
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Days []ActivityDay `json:"days"`
	// Required: true
	ActiveDays int `json:"activeDays"`
	// Required: true
	TotalReviews int `json:"totalReviews"`
}

// ActivityDay documents the DashboardActivityDay JSON shape.
//
// swagger:model DashboardActivityDay
type ActivityDay struct {
	// YYYY-MM-DD in the user's timezone
	//
	// Required: true
	Date string `json:"date"` // YYYY-MM-DD in the user's timezone
	// Required: true
	Count int `json:"count"`
}

// NextAction documents the DashboardNextAction JSON shape.
//
// swagger:model DashboardNextAction
type NextAction struct {
	// Required: true
	Type string `json:"type"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	Description string `json:"description"`
	// Required: true
	Href string `json:"href"`
	// swagger:name dueAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	DueAt *time.Time `json:"dueAt,omitempty"`
}

// Stat documents the DashboardStat JSON shape.
//
// swagger:model DashboardStat
type Stat struct {
	// Required: true
	Key string `json:"key"`
	// Required: true
	Label string `json:"label"`
	// Required: true
	Value int `json:"value"`
	// Required: true
	DisplayValue string `json:"displayValue"`
	// Required: true
	Hint string `json:"hint"`
	// Required: true
	Tone string `json:"tone"`
	// Required: false
	Href string `json:"href,omitempty"`
}

// ReviewPreviewItem documents the DashboardReviewPreviewItem JSON shape.
//
// swagger:model DashboardReviewPreviewItem
type ReviewPreviewItem struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Type string `json:"type"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	Meta string `json:"meta"`
	// swagger:name dueAt
	// Required: true
	// swagger:strfmt date-time
	DueAt time.Time `json:"dueAt"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
}

// WeakPattern documents the DashboardWeakPattern JSON shape.
//
// swagger:model DashboardWeakPattern
type WeakPattern struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Confidence int `json:"confidence"`
	// Required: true
	Signal string `json:"signal"`
}

type Metrics struct {
	DueCount        int
	DueProblemCount int
	DueCardCount    int
	DuePatternCount int
	SolvedCount     int
	ProgressCount   int
	Readiness       int
	CurrentStreak   int
}

type ReviewPreview struct {
	ID          int64
	EntityType  string
	Title       string
	PatternName string
	Difficulty  string
	DueAt       time.Time
	LastRating  *string
	Attempts    int
}
