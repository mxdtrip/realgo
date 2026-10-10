// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package response

// Лимит текущего bucket.
type RateLimitLimitHeader struct {
	// Лимит текущего bucket.
	// in: header
	Value Integer `json:"X-RateLimit-Limit"`
}

// Остаток в текущем bucket.
type RateLimitRemainingHeader struct {
	// Остаток в текущем bucket.
	// in: header
	Value Integer `json:"X-RateLimit-Remaining"`
}

// Идентификатор запроса; также доступен в meta.requestId для JSON.
type RequestIDHeader struct {
	// Идентификатор запроса; также доступен в meta.requestId для JSON.
	// in: header
	Value string `json:"X-Request-Id"`
}

// Для rate_limited — число секунд до повтора; при AI-квоте может отсутствовать.
type RetryAfterHeader struct {
	// Для rate_limited — число секунд до повтора; при AI-квоте может отсутствовать.
	// in: header
	// Minimum: 1
	Value Integer `json:"Retry-After"`
}

// Только в браузерном режиме X-Realgo-Client: web. HttpOnly refresh-cookie для session_id; refresh_token в JSON опускается.
type SessionCookieHeader struct {
	// Только в браузерном режиме X-Realgo-Client: web. HttpOnly refresh-cookie для session_id; refresh_token в JSON опускается.
	// in: header
	Value string `json:"Set-Cookie"`
}

// В web-режиме и с валидным X-Realgo-Session очищает refresh-cookie (Max-Age=0).
type ExpiredSessionCookieHeader struct {
	// В web-режиме и с валидным X-Realgo-Session очищает refresh-cookie (Max-Age=0).
	// in: header
	Value string `json:"Set-Cookie"`
}

type SwaggerErrorResponse struct {
	RequestIDHeader
	// in: body
	Body ErrorEnvelope
}

// Невалидный запрос; коды: VALIDATION_ERROR
//
// swagger:response validationError
type SwaggerValidationError struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED
//
// swagger:response unauthorized
type SwaggerUnauthorized struct {
	SwaggerErrorResponse
}

// Превышен размер тела запроса; коды: REQUEST_TOO_LARGE
//
// swagger:response requestTooLarge
type SwaggerRequestTooLarge struct {
	SwaggerErrorResponse
}

// Превышен лимит запросов либо AI-квота; коды: AI_QUOTA_EXCEEDED, rate_limited
//
// swagger:response aiQuotaExceeded
type SwaggerAiQuotaExceeded struct {
	SwaggerErrorResponse
	RetryAfterHeader
}

// Внутренняя ошибка; коды: INTERNAL_ERROR
//
// swagger:response internalError
type SwaggerInternalError struct {
	SwaggerErrorResponse
}

// Ошибка внешнего провайдера; коды: AI_PROVIDER_ERROR
//
// swagger:response aiProviderError
type SwaggerAiProviderError struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: AI_METERING_UNAVAILABLE, AI_UNAVAILABLE, auth_unavailable, rate_limit_unavailable
//
// swagger:response aiAssistantUnavailable
type SwaggerAiAssistantUnavailable struct {
	SwaggerErrorResponse
}

// Таймаут middleware (60 секунд); стандартная JSON-обёртка не гарантируется.
//
// swagger:response gatewayTimeout
type SwaggerGatewayTimeout struct {
}

// Невалидный запрос; коды: invalid_request, validation_error
//
// swagger:response invalidAuthRequest
type SwaggerInvalidAuthRequest struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, invalid_token, unauthorized
//
// swagger:response invalidDeviceSession
type SwaggerInvalidDeviceSession struct {
	SwaggerErrorResponse
}

// Браузерный Origin отклонён; коды: csrf_rejected
//
// swagger:response csrfRejected
type SwaggerCsrfRejected struct {
	SwaggerErrorResponse
}

// Превышен размер тела запроса; коды: request_too_large
//
// swagger:response authRequestTooLarge
type SwaggerAuthRequestTooLarge struct {
	SwaggerErrorResponse
}

// Превышен лимит запросов либо AI-квота; коды: rate_limited
//
// swagger:response rateLimited
type SwaggerRateLimited struct {
	SwaggerErrorResponse
	RetryAfterHeader
}

// Внутренняя ошибка; коды: internal_error
//
// swagger:response authInternalError
type SwaggerAuthInternalError struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: auth_unavailable, rate_limit_unavailable
//
// swagger:response authRateLimitUnavailable
type SwaggerAuthRateLimitUnavailable struct {
	SwaggerErrorResponse
}

// Невалидный запрос; коды: invalid_code, invalid_request
//
// swagger:response invalidVerificationCode
type SwaggerInvalidVerificationCode struct {
	SwaggerErrorResponse
}

// Невалидный запрос; коды: invalid_request
//
// swagger:response invalidRequest
type SwaggerInvalidRequest struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: auth_unavailable, rate_limit_unavailable, mail_unavailable
//
// swagger:response mailUnavailable
type SwaggerMailUnavailable struct {
	SwaggerErrorResponse
}

// Неподдерживаемое значение или недоступные данные провайдера; коды: oauth_no_email
//
// swagger:response oauthNoEmail
type SwaggerOauthNoEmail struct {
	SwaggerErrorResponse
}

// Ошибка внешнего провайдера; коды: oauth_provider_failed
//
// swagger:response oauthProviderError
type SwaggerOauthProviderError struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: auth_unavailable, oauth_unavailable, rate_limit_unavailable
//
// swagger:response oauthUnavailable
type SwaggerOauthUnavailable struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: invalid_credentials
//
// swagger:response invalidCredentials
type SwaggerInvalidCredentials struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: invalid_token
//
// swagger:response invalidToken
type SwaggerInvalidToken struct {
	SwaggerErrorResponse
}

// Конфликт состояния; коды: email_taken
//
// swagger:response emailTaken
type SwaggerEmailTaken struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: auth_unavailable
//
// swagger:response authUnavailable
type SwaggerAuthUnavailable struct {
	SwaggerErrorResponse
}

// Конфликт состояния; коды: REVIEW_CONFLICT
//
// swagger:response reviewConflict
type SwaggerReviewConflict struct {
	SwaggerErrorResponse
}

// Неподдерживаемое значение или недоступные данные провайдера; коды: UNKNOWN_PLATFORM
//
// swagger:response unknownPlatform
type SwaggerUnknownPlatform struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, invalid_credentials, unauthorized, invalid_token
//
// swagger:response invalidAccountCredentials
type SwaggerInvalidAccountCredentials struct {
	SwaggerErrorResponse
}

// Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, unauthorized, invalid_token
//
// swagger:response invalidAuthSession
type SwaggerInvalidAuthSession struct {
	SwaggerErrorResponse
}

// Сущность не найдена или недоступна; коды: NOT_FOUND
//
// swagger:response notFound
type SwaggerNotFound struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: AI_BUSY, AI_UNAVAILABLE, auth_unavailable, rate_limit_unavailable
//
// swagger:response aiGenerationUnavailable
type SwaggerAiGenerationUnavailable struct {
	SwaggerErrorResponse
}

// Без тела ответа
//
// swagger:response noContent
type SwaggerNoContent struct {
	RequestIDHeader
}

// Отсутствует/истёк access token либо неверные credentials; коды: INVALID_TOKEN, UNAUTHORIZED, unauthorized
//
// swagger:response authUnauthorized
type SwaggerAuthUnauthorized struct {
	SwaggerErrorResponse
}

// Сущность не найдена или недоступна; коды: not_found
//
// swagger:response authNotFound
type SwaggerAuthNotFound struct {
	SwaggerErrorResponse
}

// Конфликт состояния; коды: CONFLICT
//
// swagger:response cardReviewConflict
type SwaggerCardReviewConflict struct {
	SwaggerErrorResponse
}

// Конфликт состояния; коды: NO_REPLACEMENT
//
// swagger:response noReplacement
type SwaggerNoReplacement struct {
	SwaggerErrorResponse
}

// Сервис или зависимость временно недоступны; коды: postgres_unavailable, redis_unavailable
//
// swagger:response dependenciesUnavailable
type SwaggerDependenciesUnavailable struct {
	SwaggerErrorResponse
}

// Integer documents an integer without a wire-format restriction.
// swagger:type integer
type Integer int
