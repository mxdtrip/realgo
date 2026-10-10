// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package quiz

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response quizSession
type SwaggerQuizSession struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data QuizSession    `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response quizAnswered
type SwaggerQuizAnswered struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data answerResult   `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters get_api_v1_me_quiz_session
type SwaggerQuizSessionQueryParams struct {
	// По умолчанию 10. Значения выше 30 обрезаются до 30. Нечисловое или неположительное значение заменяется значением по умолчанию.
	//
	// in: query
	// Required: false
	// Default: 10
	Limit response.Integer `json:"limit"`
}

// swagger:parameters post_api_v1_me_quiz_questionId_answer
type SwaggerQuizQuestionIdAnswerBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body answerRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_quiz_questionId_answer
type SwaggerQuizQuestionIdAnswerPathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	QuestionID int64 `json:"questionId"`
}
