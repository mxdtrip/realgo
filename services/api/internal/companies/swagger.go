// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package companies

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response companyList
type SwaggerCompanyList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []Company      `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters get_api_v1_companies_search
type SwaggerCompaniesSearchQueryParams struct {
	// Строка поиска; учитываются алиасы вроде facebook → Meta. Пустая строка допускается.
	//
	// in: query
	// Required: false
	Query string `json:"query"`
	// По умолчанию 8, максимум выдачи 20. Значения ≤0 заменяются на 8, >20 обрезаются до 20. Нечисловое значение: 400.
	//
	// in: query
	// Required: false
	// Default: 8
	Limit response.Integer `json:"limit"`
}
