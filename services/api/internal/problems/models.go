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
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	ExternalID string `json:"externalId"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	URL string `json:"url"`
	// Required: true
	Platform string `json:"platform"`
	// Required: true
	Difficulty string `json:"difficulty"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Pattern *ProblemPattern `json:"pattern"`
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
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// swagger:name solvedAt
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solvedAt"`
	// Required: true
	HintsUsed int `json:"hintsUsed"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Note *string `json:"note"`
	// swagger:name createdAt
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
	// swagger:name updatedAt
	// Required: true
	// swagger:strfmt date-time
	UpdatedAt time.Time `json:"updatedAt"`
}

// Problem documents the ProblemsProblem JSON shape.
//
// swagger:model ProblemsProblem
type Problem struct {
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	ExternalID string `json:"externalId"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	URL string `json:"url"`
	// Required: true
	Platform string `json:"platform"`
	// Required: true
	Difficulty string `json:"difficulty"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Pattern *ProblemPattern `json:"pattern"`
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
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// swagger:name solvedAt
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solvedAt"`
	// HintsUsed — сколько подсказок ассистента реально выдано по задаче
	// (успешные assistant_hint-запросы этого пользователя).
	// Required: true
	HintsUsed int `json:"hintsUsed"`
	// swagger:name createdAt
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
	// swagger:name updatedAt
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
