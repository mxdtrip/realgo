// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package v1

import (
	reviewrequest "github.com/mxdtrip/realgo/services/api/internal/controller/v1/request"
	reviewresponse "github.com/mxdtrip/realgo/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response problemAttempt
type SwaggerProblemAttempt struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data reviewresponse.ProblemAttemptData `json:"data"`
		Meta *response.Meta                    `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response reviewQueue
type SwaggerReviewQueue struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data []reviewresponse.ReviewItem `json:"data"`
		Meta *response.Meta              `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response reviewStats
type SwaggerReviewStats struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data reviewresponse.StatsResponse `json:"data"`
		Meta *response.Meta               `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response reviewRated
type SwaggerReviewRated struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data reviewresponse.RateReviewData `json:"data"`
		Meta *response.Meta                `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_me_reviews_problems_problemId_attempt
type SwaggerReviewsProblemsProblemIdAttemptBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body reviewrequest.ProblemAttemptRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_reviews_problems_problemId_attempt
type SwaggerReviewsProblemsProblemIdAttemptPathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	// Minimum: 1
	ProblemID int64 `json:"problemId"`
}

// swagger:parameters get_api_v1_me_reviews_queue
type SwaggerReviewsQueueQueryParams struct {
	// Просроченные или будущие повторения.
	//
	// in: query
	// Required: false
	// Default: "due"
	// Enum: ["due", "upcoming"]
	Status string `json:"status"`
	// По умолчанию 50. Значения выше 100 обрезаются до 100. Нечисловое или неположительное значение заменяется значением по умолчанию.
	//
	// in: query
	// Required: false
	// Default: 50
	Limit response.Integer `json:"limit"`
	// Непрозрачный курсор из meta.nextCursor. При отсутствии ключа следующей страницы нет. Невалидный курсор: 400.
	//
	// in: query
	// Required: false
	Cursor string `json:"cursor"`
}

// swagger:parameters post_api_v1_me_reviews_reviewId_rate
type SwaggerReviewsReviewIdRateBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body reviewrequest.RateReviewRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_reviews_reviewId_rate
type SwaggerReviewsReviewIdRatePathParams struct {
	// Числовой ID, а не prb_*/card_* строка.
	//
	// in: path
	// Required: true
	ReviewID int64 `json:"reviewId"`
}
