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
	// NextAction is the nextAction JSON field.
	//
	// Required: true
	NextAction NextAction `json:"nextAction"`
	// Stats is the stats JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Stats []Stat `json:"stats"`
	// ReviewPreview is the reviewPreview JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ReviewPreview []ReviewPreviewItem `json:"reviewPreview"`
	// WeakPatterns is the weakPatterns JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	WeakPatterns []WeakPattern `json:"weakPatterns"`
	// Activity is the activity JSON field.
	//
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
	// Days is the days JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Days []ActivityDay `json:"days"`
	// ActiveDays is the activeDays JSON field.
	//
	// Required: true
	ActiveDays int `json:"activeDays"`
	// TotalReviews is the totalReviews JSON field.
	//
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
	// Count is the count JSON field.
	//
	// Required: true
	Count int `json:"count"`
}

// NextAction documents the DashboardNextAction JSON shape.
//
// swagger:model DashboardNextAction
type NextAction struct {
	// Type is the type JSON field.
	//
	// Required: true
	Type string `json:"type"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Description is the description JSON field.
	//
	// Required: true
	Description string `json:"description"`
	// Href is the href JSON field.
	//
	// Required: true
	Href string `json:"href"`
	// swagger:name dueAt
	// DueAt is the dueAt JSON field.
	//
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
	// Key is the key JSON field.
	//
	// Required: true
	Key string `json:"key"`
	// Label is the label JSON field.
	//
	// Required: true
	Label string `json:"label"`
	// Value is the value JSON field.
	//
	// Required: true
	Value int `json:"value"`
	// DisplayValue is the displayValue JSON field.
	//
	// Required: true
	DisplayValue string `json:"displayValue"`
	// Hint is the hint JSON field.
	//
	// Required: true
	Hint string `json:"hint"`
	// Tone is the tone JSON field.
	//
	// Required: true
	Tone string `json:"tone"`
	// Href is the href JSON field.
	//
	// Required: false
	Href string `json:"href,omitempty"`
}

// ReviewPreviewItem documents the DashboardReviewPreviewItem JSON shape.
//
// swagger:model DashboardReviewPreviewItem
type ReviewPreviewItem struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID string `json:"id"`
	// Type is the type JSON field.
	//
	// Required: true
	Type string `json:"type"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Meta is the meta JSON field.
	//
	// Required: true
	Meta string `json:"meta"`
	// swagger:name dueAt
	// DueAt is the dueAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	DueAt time.Time `json:"dueAt"`
	// LastRating is the lastRating JSON field.
	//
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
	// ID is the id JSON field.
	//
	// Required: true
	ID string `json:"id"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Confidence is the confidence JSON field.
	//
	// Required: true
	Confidence int `json:"confidence"`
	// Signal is the signal JSON field.
	//
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
