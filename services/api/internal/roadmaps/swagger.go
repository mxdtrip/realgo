// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package roadmaps

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response roadmapCatalog
type SwaggerRoadmapCatalog struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data Response       `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}
