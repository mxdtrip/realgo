// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package ai

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

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

// Успешный ответ
//
// swagger:response assistantHint
type SwaggerAssistantHint struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	// Extensions:
	// ---
	// x-doc-response-extensions: {"x-sse": {"example": "event: delta\ndata: {\"text\":\"Попробуй использовать хеш-таблицу.\"}\n\nevent: done\ndata: {\"hint\":\"Попробуй использовать хеш-таблицу.\",\"stage\":\"nudge\",\"problemKnown\":true}\n\n", "schema": {"type": "string"}}}
	// ---
	Body struct {
		// Required: true
		Data AssistantHintResponse `json:"data"`
		Meta *response.Meta        `json:"meta,omitempty"`
	}
}

// Карточки уже готовы (status=ready)
//
// swagger:response cardsReady
type SwaggerCardsReady struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response cardsGenerating
type SwaggerCardsGenerating struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response quizQueued
type SwaggerQuizQueued struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data QuizGenerationQueued `json:"data"`
		Meta *response.Meta       `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_assistant_hint
type SwaggerAssistantHintBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body AssistantHintRequest `json:"body"`
}

// swagger:parameters post_api_v1_assistant_hint
type SwaggerAssistantHintQueryParams struct {
	// Только значение 1 включает SSE. Иначе возвращается обычный JSON.
	//
	// in: query
	// Required: false
	Stream string `json:"stream"`
}

// swagger:parameters post_api_v1_me_cards_generate
type SwaggerCardsGenerateBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body GenerateCardRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_quiz_generate
type SwaggerQuizGenerateBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body GenerateQuizRequest `json:"body"`
}
