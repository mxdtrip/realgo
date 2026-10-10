// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package patterns

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response patternList
type SwaggerPatternList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data PatternsList   `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response patternAtlas
type SwaggerPatternAtlas struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data AtlasResponse  `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response atlasCompanies
type SwaggerAtlasCompanies struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data AtlasCompanies `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response patternNode
type SwaggerPatternNode struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data NodeDetail     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response weakPatterns
type SwaggerWeakPatterns struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []WeakPattern  `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response patternDetail
type SwaggerPatternDetail struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data PatternDetail  `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters get_api_v1_me_patterns_atlas get_api_v1_patterns_atlas
type SwaggerPatternsAtlasQueryParams struct {
	// Необязательный код компании. Если у компании нет relevance data, возвращается 404.
	//
	// in: query
	// Required: false
	Company string `json:"company"`
}

// swagger:parameters get_api_v1_me_patterns_atlas_code get_api_v1_me_patterns_code get_api_v1_patterns_atlas_code get_api_v1_patterns_code
type SwaggerPatternsAtlasCodePathParams struct {
	// Код паттерна или субпаттерна.
	//
	// in: path
	// Required: true
	// Min Length: 1
	Code string `json:"code"`
}

// swagger:parameters get_api_v1_me_patterns_atlas_code get_api_v1_patterns_atlas_code
type SwaggerPatternsAtlasCodeQueryParams struct {
	// Необязательный фильтр платформы для practice-секции. Например hackerrank.
	//
	// in: query
	// Required: false
	Platform string `json:"platform"`
}

// swagger:parameters get_api_v1_me_patterns_weak get_api_v1_patterns_weak
type SwaggerPatternsWeakQueryParams struct {
	// По умолчанию 5. Значения выше 20 обрезаются до 20. Нечисловое или неположительное значение заменяется значением по умолчанию.
	//
	// in: query
	// Required: false
	// Default: 5
	Limit response.Integer `json:"limit"`
}
