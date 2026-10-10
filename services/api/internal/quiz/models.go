package quiz

import "time"

type sessionQuestion struct {
	ID           int64
	Question     string
	Options      []string
	Difficulty   *string
	CreatedByAI  bool
	CreatedAt    *time.Time
	ProblemID    *int64
	ProblemTitle *string
	PatternID    *int64
	PatternName  *string
}

type questionDetail struct {
	CorrectOption int
	OptionCount   int
	Explanation   *string
	// ProblemID непуст, только если вопрос привязан к problem (а не к pattern).
	// Нужен сервису, чтобы обновить confidence и (позже) прогнать FSRS.
	ProblemID *int64
}

// questionItem documents the QuizQuestionItem JSON shape.
//
// swagger:model QuizQuestionItem
type questionItem struct {
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	Question string `json:"question"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Options []string `json:"options"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Difficulty *string `json:"difficulty"`
	// Required: true
	CreatedByAI bool `json:"created_by_ai"`
	// Required: true
	CreatedAt string `json:"created_at"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemID *int64 `json:"problem_id"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemTitle *string `json:"problem_title"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternID *int64 `json:"pattern_id"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternName *string `json:"pattern_name"`
}

// answerRequest documents the QuizAnswerRequest JSON shape.
//
// Example: {"option":0}
//
// swagger:model QuizAnswerRequest
// swagger:additionalProperties false
type answerRequest struct {
	// Индекс варианта ответа с нуля, меньше количества options. Отсутствующее поле читается как 0; повторный ответ возвращает 409.
	//
	// Required: false
	// Minimum: 0
	Option int `json:"option"`
}

// answerResult documents the QuizAnswerResult JSON shape.
//
// swagger:model QuizAnswerResult
type answerResult struct {
	// Required: true
	Correct bool `json:"correct"`
	// Required: true
	CorrectOption int `json:"correct_option"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Explanation *string `json:"explanation"`
}

func questionItemFromSessionQuestion(q sessionQuestion) questionItem {
	item := questionItem{
		ID:           q.ID,
		Question:     q.Question,
		Options:      q.Options,
		Difficulty:   q.Difficulty,
		CreatedByAI:  q.CreatedByAI,
		ProblemID:    q.ProblemID,
		ProblemTitle: q.ProblemTitle,
		PatternID:    q.PatternID,
		PatternName:  q.PatternName,
	}
	if item.Options == nil {
		item.Options = []string{}
	}
	if q.CreatedAt != nil {
		item.CreatedAt = q.CreatedAt.UTC().Format(time.RFC3339)
	}
	return item
}
