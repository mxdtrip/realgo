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
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Question is the question JSON field.
	//
	// Required: true
	Question string `json:"question"`
	// Options is the options JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Options []string `json:"options"`
	// Difficulty is the difficulty JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Difficulty *string `json:"difficulty"`
	// CreatedByAI is the created_by_ai JSON field.
	//
	// Required: true
	CreatedByAI bool `json:"created_by_ai"`
	// CreatedAt is the created_at JSON field.
	//
	// Required: true
	CreatedAt string `json:"created_at"`
	// ProblemID is the problem_id JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemID *int64 `json:"problem_id"`
	// ProblemTitle is the problem_title JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemTitle *string `json:"problem_title"`
	// PatternID is the pattern_id JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternID *int64 `json:"pattern_id"`
	// PatternName is the pattern_name JSON field.
	//
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
	// Correct is the correct JSON field.
	//
	// Required: true
	Correct bool `json:"correct"`
	// CorrectOption is the correct_option JSON field.
	//
	// Required: true
	CorrectOption int `json:"correct_option"`
	// Explanation is the explanation JSON field.
	//
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
