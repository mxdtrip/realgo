// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package practice

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response practiceList
type SwaggerPracticeList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data PracticeList   `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response practiceAdded
type SwaggerPracticeAdded struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data PracticeAdded  `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_me_practice_subpatterns
type SwaggerPracticeSubpatternsBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body addRequest `json:"body"`
}

// swagger:parameters delete_api_v1_me_practice_subpatterns_code
type SwaggerPracticeSubpatternsCodePathParams struct {
	// Код паттерна или субпаттерна.
	//
	// in: path
	// Required: true
	// Min Length: 1
	Code string `json:"code"`
}
