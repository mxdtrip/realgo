// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package problems

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response problemList
type SwaggerProblemList struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []Problem      `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response problemDetail
type SwaggerProblemDetail struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data ProblemDetail  `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response problemSaved
type SwaggerProblemSaved struct {
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

// swagger:parameters get_api_v1_me_problems
type SwaggerProblemsQueryParams struct {
	// Фильтр состояния задачи.
	//
	// in: query
	// Required: false
	// Enum: ["saved", "reviewing", "mastered", "archived"]
	Status string `json:"status"`
	// Фильтр платформы.
	//
	// in: query
	// Required: false
	// Enum: ["leetcode", "hackerrank", "codeforces", "geeksforgeeks", "custom"]
	Platform string `json:"platform"`
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

// swagger:parameters get_api_v1_me_problems_problemId post_api_v1_me_problems_problemId_save
type SwaggerProblemsProblemIdPathParams struct {
	// Числовой ID, а не prb_*/card_* строка. Handler проверяет разбор int64, но не проверяет >0; отсутствующий ID приводит к 404.
	//
	// in: path
	// Required: true
	ProblemID int64 `json:"problemId"`
}
