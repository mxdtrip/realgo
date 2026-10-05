package problems

import (
	"errors"
	"time"
)

var errNotFound = errors.New("problem not found")

// ProblemDetail is returned by GET /me/problems/{id}. It is a strict superset
// of Problem (list): every list field is present with the same JSON key, plus
// Note. Casing is camelCase to match the list model, the contract doc and both
// frontends (issue #243).
// ProblemDetail documents the ProblemsProblemDetail JSON shape.
//
// swagger:model ProblemsProblemDetail
type ProblemDetail struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// ExternalID is the externalId JSON field.
	//
	// Required: true
	ExternalID string `json:"externalId"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// URL is the url JSON field.
	//
	// Required: true
	URL string `json:"url"`
	// Platform is the platform JSON field.
	//
	// Required: true
	Platform string `json:"platform"`
	// Difficulty is the difficulty JSON field.
	//
	// Required: true
	Difficulty string `json:"difficulty"`
	// Pattern is the pattern JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Pattern *ProblemPattern `json:"pattern"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"nextReviewAt"`
	// LastRating is the lastRating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// swagger:name solvedAt
	// SolvedAt is the solvedAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solvedAt"`
	// HintsUsed is the hintsUsed JSON field.
	//
	// Required: true
	HintsUsed int `json:"hintsUsed"`
	// Note is the note JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Note *string `json:"note"`
	// swagger:name createdAt
	// CreatedAt is the createdAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
	// swagger:name updatedAt
	// UpdatedAt is the updatedAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	UpdatedAt time.Time `json:"updatedAt"`
}

// Problem documents the ProblemsProblem JSON shape.
//
// swagger:model ProblemsProblem
type Problem struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// ExternalID is the externalId JSON field.
	//
	// Required: true
	ExternalID string `json:"externalId"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// URL is the url JSON field.
	//
	// Required: true
	URL string `json:"url"`
	// Platform is the platform JSON field.
	//
	// Required: true
	Platform string `json:"platform"`
	// Difficulty is the difficulty JSON field.
	//
	// Required: true
	Difficulty string `json:"difficulty"`
	// Pattern is the pattern JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Pattern *ProblemPattern `json:"pattern"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"nextReviewAt"`
	// LastRating is the lastRating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// swagger:name solvedAt
	// SolvedAt is the solvedAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solvedAt"`
	// HintsUsed — сколько подсказок ассистента реально выдано по задаче
	// (успешные assistant_hint-запросы этого пользователя).
	// HintsUsed is the hintsUsed JSON field.
	//
	// Required: true
	HintsUsed int `json:"hintsUsed"`
	// swagger:name createdAt
	// CreatedAt is the createdAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
	// swagger:name updatedAt
	// UpdatedAt is the updatedAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	UpdatedAt time.Time `json:"updatedAt"`
}

// swagger:model ProblemsProblemPattern
type ProblemPattern struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Name string `json:"name"`
}

type ListResponse struct {
	Data []Problem `json:"data"`
	Meta ListMeta  `json:"meta"`
}

type ListMeta struct {
	NextCursor *string `json:"nextCursor"`
}

type ListParams struct {
	Limit    int32
	Status   string
	Platform string
	Cursor   Cursor
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}
