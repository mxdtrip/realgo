// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package cards

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response cardList
type SwaggerCardList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []Card         `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response cardDetail
type SwaggerCardDetail struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data CardDetail     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response cardDueSummary
type SwaggerCardDueSummary struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data DueSummary     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response cardSession
type SwaggerCardSession struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data Session        `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response cardRated
type SwaggerCardRated struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data RateResult     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters get_api_v1_me_cards
type SwaggerCardsQueryParams struct {
	// Фильтр типа карточек.
	//
	// in: query
	// Required: false
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// Фильтр кода паттерна.
	//
	// in: query
	// Required: false
	PatternCode string `json:"patternCode"`
	// По умолчанию 50. Значения выше 100 обрезаются до 100. Нечисловое или неположительное значение: 400.
	//
	// in: query
	// Required: false
	// Minimum: 1
	// Default: 50
	Limit response.Integer `json:"limit"`
	// Непрозрачный курсор из meta.nextCursor. При отсутствии ключа следующей страницы нет. Невалидный курсор: 400.
	//
	// in: query
	// Required: false
	Cursor string `json:"cursor"`
}

// swagger:parameters post_api_v1_me_cards
type SwaggerCardsBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body createCardRequest `json:"body"`
}

// swagger:parameters get_api_v1_me_cards_session
type SwaggerCardsSessionQueryParams struct {
	// Область сессии: просроченные, сложные, все или практика.
	//
	// in: query
	// Required: false
	// Default: "due"
	// Enum: ["due", "hard_normal", "all", "practice"]
	Scope string `json:"scope"`
	// Фильтр кода паттерна.
	//
	// in: query
	// Required: false
	PatternCode string `json:"patternCode"`
	// По умолчанию 20. Значения выше 100 обрезаются до 100. Нечисловое или неположительное значение: 400.
	//
	// in: query
	// Required: false
	// Minimum: 1
	// Default: 20
	Limit response.Integer `json:"limit"`
}

// swagger:parameters delete_api_v1_me_cards_cardId get_api_v1_me_cards_cardId patch_api_v1_me_cards_cardId post_api_v1_me_cards_cardId_rate
type SwaggerCardsCardIdPathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	// Minimum: 1
	CardID int64 `json:"cardId"`
}

// swagger:parameters patch_api_v1_me_cards_cardId
type SwaggerCardsCardIdBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body updateCardRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_cards_cardId_rate
type SwaggerCardsCardIdRateBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body RateRequest `json:"body"`
}
