package request

// RateReviewRequest для POST /me/reviews/{reviewId}/rate
type RateReviewRequest struct {
	Rating     string `json:"rating"`     // hard, normal, easy
	ReviewedAt string `json:"reviewedAt"` // ISO 8601
}

type ProblemAttemptRequest struct {
	Outcome     string `json:"outcome"`     // not_solved, hard, normal, easy
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
