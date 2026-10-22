// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package reports

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response reportCreated
type SwaggerReportCreated struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data Result         `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_me_problem_reports
type SwaggerProblemReportsFormDataParams struct {
	// JSON-текст объекта ReportsRequest, одной строкой.
	//
	// in: formData
	// Required: true
	// Default: "{\"schemaVersion\": 2, \"description\": \"При открытии карточек не отображается список.\", \"reportedAt\": \"2026-10-05T16:00:00Z\", \"page\": {\"route\": \"/cards\", \"viewport\": {\"width\": 1920, \"height\": 1080}, \"locale\": \"ru\", \"timezone\": \"Asia/Yekaterinburg\", \"online\": true}, \"browser\": {\"name\": \"Firefox\", \"version\": \"157.0\", \"engine\": \"Gecko\"}, \"os\": {\"name\": \"Linux\", \"version\": \"\"}, \"network\": null, \"breadcrumbs\": [], \"errors\": [], \"release\": {\"version\": \"dev\", \"commit\": \"d86d771f0751c7c1174fb2dc318c377eeeb3b297\"}}"
	// Extensions:
	// ---
	// x-example: "{\"schemaVersion\": 2, \"description\": \"При открытии карточек не отображается список.\", \"reportedAt\": \"2026-10-05T16:00:00Z\", \"page\": {\"route\": \"/cards\", \"viewport\": {\"width\": 1920, \"height\": 1080}, \"locale\": \"ru\", \"timezone\": \"Asia/Yekaterinburg\", \"online\": true}, \"browser\": {\"name\": \"Firefox\", \"version\": \"157.0\", \"engine\": \"Gecko\"}, \"os\": {\"name\": \"Linux\", \"version\": \"\"}, \"network\": null, \"breadcrumbs\": [], \"errors\": [], \"release\": {\"version\": \"dev\", \"commit\": \"d86d771f0751c7c1174fb2dc318c377eeeb3b297\"}}"
	// ---
	Report string `json:"report"`
	// Необязательный один файл: фото/UTF-8 текст до 5 MiB, видео до 15 MiB.
	//
	// in: formData
	// swagger:file
	Attachment string `json:"attachment"`
}
