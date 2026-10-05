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

// QuizGenerationQueued documents a map-shaped HTTP payload.
//
// swagger:model QuizGenerationQueued
type QuizGenerationQueued struct {
	// Required: true
	Request_id int64 `json:"request_id"`
	// Required: true
	// Enum: ["queued"]
	Status string `json:"status"`
	// Required: true
	Message string `json:"message"`
}
