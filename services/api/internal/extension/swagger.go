// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package extension

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response extensionEvent
type SwaggerExtensionEvent struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data EventResult    `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response extensionStatus
type SwaggerExtensionStatus struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data StatusResponse `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_extension_events
type SwaggerExtensionEventsBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body EventRequest `json:"body"`
}

// swagger:parameters get_api_v1_me_extension_status
type SwaggerExtensionStatusQueryParams struct {
	// Количество последних событий. По умолчанию 10; значения выше 50 обрезаются до 50. Нечисловое или неположительное значение заменяется на 10.
	//
	// in: query
	// Required: false
	// Default: 10
	Limit response.Integer `json:"limit"`
}
