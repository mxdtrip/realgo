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
	// Required: true
	ID int64 `json:"id"`
	// problem, card, pattern
	//
	// Required: true
	EntityType string `json:"entityType"` // problem, card, pattern
	// Required: true
	EntityID int64 `json:"entityId"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	Meta string `json:"meta"`
	// Required: true
	TypeLabel string `json:"typeLabel"`
	// swagger:name dueAt
	// Required: true
	// swagger:strfmt date-time
	DueAt time.Time `json:"dueAt"`
	// due, upcoming, completed
	//
	// Required: true
	Status string `json:"status"` // due, upcoming, completed
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// Required: true
	Attempts int `json:"attempts"`
	// EntityURL — внешняя ссылка «перерешать на платформе» (для problem-элементов).
	// Required: true
	EntityURL string `json:"entityUrl"`
	// PatternCode — код паттерна для ссылки на /patterns/{code}/session.
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
	// Required: true
	ReviewID int64 `json:"reviewId"`
	// Required: true
	Rating string `json:"rating"`
	// swagger:name nextReviewAt
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
	// Required: true
	ProblemID int64 `json:"problemId"`
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
	// Required: true
	TotalReviews int `json:"totalReviews"`
	// Required: true
	NewCards int `json:"newCards"`
	// Required: true
	LearningCards int `json:"learningCards"`
	// Required: true
	ReviewCards int `json:"reviewCards"`
}
