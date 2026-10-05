package response

import "time"

// QueueResponse для GET /me/reviews/queue
type QueueResponse struct {
	Data []ReviewItem `json:"data"`
	Meta QueueMeta    `json:"meta"`
}

// ReviewItem для элемента очереди
// ReviewItem documents the ReviewsReviewItem JSON shape.
//
// swagger:model ReviewsReviewItem
type ReviewItem struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// problem, card, pattern
	//
	// Required: true
	EntityType string `json:"entityType"` // problem, card, pattern
	// EntityID is the entityId JSON field.
	//
	// Required: true
	EntityID int64 `json:"entityId"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Meta is the meta JSON field.
	//
	// Required: true
	Meta string `json:"meta"`
	// TypeLabel is the typeLabel JSON field.
	//
	// Required: true
	TypeLabel string `json:"typeLabel"`
	// swagger:name dueAt
	// DueAt is the dueAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	DueAt time.Time `json:"dueAt"`
	// due, upcoming, completed
	//
	// Required: true
	Status string `json:"status"` // due, upcoming, completed
	// LastRating is the lastRating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// Attempts is the attempts JSON field.
	//
	// Required: true
	Attempts int `json:"attempts"`
	// EntityURL — внешняя ссылка «перерешать на платформе» (для problem-элементов).
	// EntityURL is the entityUrl JSON field.
	//
	// Required: true
	EntityURL string `json:"entityUrl"`
	// PatternCode — код паттерна для ссылки на /patterns/{code}/session.
	// PatternCode is the patternCode JSON field.
	//
	// Required: true
	PatternCode string `json:"patternCode"`
}

// QueueMeta для пагинации
type QueueMeta struct {
	NextCursor *string `json:"nextCursor"`
}

// RateReviewResponse для POST /me/reviews/{reviewId}/rate
// Обёрнут в data согласно контракту
type RateReviewResponse struct {
	Data RateReviewData `json:"data"`
}

// RateReviewData — данные ответа
// Обёрнут в data согласно контракту
// RateReviewData documents the ReviewsRateReviewData JSON shape.
//
// swagger:model ReviewsRateReviewData
type RateReviewData struct {
	// ReviewID is the reviewId JSON field.
	//
	// Required: true
	ReviewID int64 `json:"reviewId"`
	// Rating is the rating JSON field.
	//
	// Required: true
	Rating string `json:"rating"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	NextReviewAt time.Time `json:"nextReviewAt"`
	// completed
	//
	// Required: true
	Status string `json:"status"` // completed
}

// ProblemAttemptData documents the ReviewsProblemAttemptData JSON shape.
//
// swagger:model ReviewsProblemAttemptData
type ProblemAttemptData struct {
	// ProblemID is the problemId JSON field.
	//
	// Required: true
	ProblemID int64 `json:"problemId"`
	// Outcome is the outcome JSON field.
	//
	// Required: true
	Outcome string `json:"outcome"`
	// in_progress or reviewing
	//
	// Required: true
	Status string `json:"status"` // in_progress or reviewing
}

// StatsResponse для GET /me/reviews/stats
// StatsResponse documents the ReviewsStatsResponse JSON shape.
//
// swagger:model ReviewsStatsResponse
type StatsResponse struct {
	// TotalReviews is the totalReviews JSON field.
	//
	// Required: true
	TotalReviews int `json:"totalReviews"`
	// NewCards is the newCards JSON field.
	//
	// Required: true
	NewCards int `json:"newCards"`
	// LearningCards is the learningCards JSON field.
	//
	// Required: true
	LearningCards int `json:"learningCards"`
	// ReviewCards is the reviewCards JSON field.
	//
	// Required: true
	ReviewCards int `json:"reviewCards"`
}
