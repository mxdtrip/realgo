// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package roadmap

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response roadmap
type SwaggerRoadmap struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data Response       `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response theoryCompleted
type SwaggerTheoryCompleted struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data TheoryCompletion `json:"data"`
		Meta *response.Meta   `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response roadmapTaskAccess
type SwaggerRoadmapTaskAccess struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data TaskAccessResolution `json:"data"`
		Meta *response.Meta       `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response roadmapList
type SwaggerRoadmapList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []Summary      `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters put_api_v1_me_roadmap post_api_v1_me_roadmap_preview
type SwaggerRoadmapBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body ConfigRequest `json:"body"`
}

// swagger:parameters put_api_v1_me_roadmap_patterns_code_theory
type SwaggerRoadmapPatternsCodeTheoryPathParams struct {
	// Код паттерна или субпаттерна. После trim — не более 160 байт.
	//
	// in: path
	// Required: true
	// Min Length: 1
	Code string `json:"code"`
}

// swagger:parameters post_api_v1_me_roadmap_tasks_problemID_access
type SwaggerRoadmapTasksProblemIDAccessBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body TaskAccessRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_roadmap_tasks_problemID_access
type SwaggerRoadmapTasksProblemIDAccessPathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	// Minimum: 1
	ProblemID int64 `json:"problemID"`
}

// swagger:parameters put_api_v1_me_roadmaps_planKey_activate
type SwaggerRoadmapsPlanKeyActivatePathParams struct {
	// planKey из GET /me/roadmaps; не более 240 байт. При наличии : кодируйте его как часть URL.
	//
	// in: path
	// Required: true
	// Min Length: 1
	PlanKey string `json:"planKey"`
}
