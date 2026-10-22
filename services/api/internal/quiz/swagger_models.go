package quiz

// QuizSession documents a map-shaped HTTP payload.
//
// swagger:model QuizSession
type QuizSession struct {
	// Required: true
	Questions []questionItem `json:"questions"`
	// Required: true
	Total int64 `json:"total"`
}
