package request

// RateReviewRequest для POST /me/reviews/{reviewId}/rate
// RateReviewRequest documents the ReviewsRequestRateReviewRequest JSON shape.
//
// Example: {"rating":"easy","reviewedAt":"2026-10-05T16:00:00Z"}
//
// swagger:model ReviewsRequestRateReviewRequest
// swagger:additionalProperties false
type RateReviewRequest struct {
	// hard, normal, easy
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	Rating string `json:"rating"` // hard, normal, easy
	// swagger:name reviewedAt
	// ISO 8601
	//
	// Required: true
	// swagger:strfmt date-time
	ReviewedAt string `json:"reviewedAt"` // ISO 8601
}

// ProblemAttemptRequest documents the ReviewsRequestProblemAttemptRequest JSON shape.
//
// Example: {"outcome":"not_solved","attemptedAt":"2026-10-05T16:00:00Z"}
//
// swagger:model ReviewsRequestProblemAttemptRequest
// swagger:additionalProperties false
type ProblemAttemptRequest struct {
	// not_solved, hard, normal, easy
	//
	// Required: true
	// Enum: ["not_solved", "hard", "normal", "easy"]
	Outcome string `json:"outcome"` // not_solved, hard, normal, easy
	// swagger:name attemptedAt
	// ISO 8601
	//
	// Required: true
	// swagger:strfmt date-time
	AttemptedAt string `json:"attemptedAt"` // ISO 8601
}

func (r ProblemAttemptRequest) Valid() bool {
	switch r.Outcome {
	case "not_solved", "hard", "normal", "easy":
		return true
	default:
		return false
	}
}

// Valid проверяет корректность рейтинга
func (r RateReviewRequest) Valid() bool {
	switch r.Rating {
	case "hard", "normal", "easy":
		return true
	default:
		return false
	}
}
