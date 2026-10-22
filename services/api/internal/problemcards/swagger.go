// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package problemcards

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response problemCards
type SwaggerProblemCards struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data Response       `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters get_api_v1_me_problems_problemId_cards
type SwaggerProblemsProblemIdCardsPathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	// Minimum: 1
	ProblemID int64 `json:"problemId"`
}
