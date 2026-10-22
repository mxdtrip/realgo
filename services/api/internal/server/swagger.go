// Documentation types bind operations to existing request and response DTOs.
// They are never used to serialize HTTP traffic.
package server

import (
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

// Успешный ответ
//
// swagger:response deviceSession
type SwaggerDeviceSession struct {
	response.SessionCookieHeader
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data TokensData     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response authSession
type SwaggerAuthSession struct {
	response.SessionCookieHeader
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data authResponse   `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response verificationRequested
type SwaggerVerificationRequested struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["verification_requested"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response loggedOut
type SwaggerLoggedOut struct {
	response.ExpiredSessionCookieHeader
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["logged_out"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response passwordReset
type SwaggerPasswordReset struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["password_reset"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response resetRequested
type SwaggerResetRequested struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["reset_requested"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response refreshedTokens
// Examples:
//
//	application/json: {"data": {"tokens": {"access_token": "<access_token>", "expires_in": 900, "refresh_token": "<refresh_token>", "session_id": "sssssssssssssssssssssssssssssssssssssssssss", "token_type": "Bearer"}}, "meta": {"requestId": "example-request-id"}}
type SwaggerRefreshedTokens struct {
	response.SessionCookieHeader
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	// Extensions:
	// ---
	// x-doc-response-extensions: {"x-examples": {"api": {"data": {"tokens": {"access_token": "<access_token>", "expires_in": 900, "refresh_token": "<refresh_token>", "session_id": "sssssssssssssssssssssssssssssssssssssssssss", "token_type": "Bearer"}}, "meta": {"requestId": "example-request-id"}}, "web": {"data": {"tokens": {"access_token": "<access_token>", "expires_in": 900, "session_id": "sssssssssssssssssssssssssssssssssssssssssss", "token_type": "Bearer"}}, "meta": {"requestId": "example-request-id"}}}}
	// ---
	Body struct {
		// Required: true
		Data TokensData     `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Staging/local: аккаунт и сессия созданы без email verification (APP_ENV != production)
//
// swagger:response registrationCreated
type SwaggerRegistrationCreated struct {
	response.SessionCookieHeader
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data authResponse   `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Production: письмо поставлено в очередь; подтвердите код с challenge
//
// swagger:response registrationPending
type SwaggerRegistrationPending struct {
	response.RateLimitLimitHeader
	response.RateLimitRemainingHeader
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data RegistrationPending `json:"data"`
		Meta *response.Meta      `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response accountDeleted
type SwaggerAccountDeleted struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["deleted"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response userDataResponse
type SwaggerUserDataResponse struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data UserData       `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response exportAccepted
type SwaggerExportAccepted struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data ExportAcknowledged `json:"data"`
		Meta *response.Meta     `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response passwordChanged
type SwaggerPasswordChanged struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["password_changed"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response sessionsRevoked
type SwaggerSessionsRevoked struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["sessions_revoked"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response live
type SwaggerLive struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["ok"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// Успешный ответ
//
// swagger:response ready
type SwaggerReady struct {
	response.RequestIDHeader
	// in: body
	Body struct {
		// Required: true
		Data struct {
			// Required: true
			// Enum: ["ready"]
			Status string `json:"status"`
		} `json:"data"`
		Meta *response.Meta `json:"meta,omitempty"`
	}
}

// swagger:parameters post_api_v1_auth_device_session post_api_v1_auth_logout post_api_v1_auth_refresh
type SwaggerAuthDeviceSessionBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body refreshRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_device_session post_api_v1_auth_logout post_api_v1_auth_refresh
type SwaggerAuthDeviceSessionHeaderParams struct {
	// web включает браузерный refresh-cookie режим. Для Swagger/Postman оставьте пустым.
	//
	// in: header
	// Required: false
	// Enum: ["web"]
	XRealgoClient string `json:"X-Realgo-Client"`
	// В web-режиме браузер автоматически передаёт origin; JavaScript не может произвольно изменить этот заголовок.
	//
	// in: header
	// Required: false
	Origin string `json:"Origin"`
	// Обязательно в web-режиме: session_id соответствующей refresh-cookie.
	//
	// in: header
	// Required: false
	// Pattern: ^[A-Za-z0-9_-]{43}$
	XRealgoSession string `json:"X-Realgo-Session"`
}

// swagger:parameters post_api_v1_auth_email_verification_confirm
type SwaggerAuthEmailVerificationConfirmBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body emailVerificationConfirmRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_email_verification_confirm post_api_v1_auth_email_verification_request post_api_v1_auth_github post_api_v1_auth_login post_api_v1_auth_password_reset_confirm post_api_v1_auth_password_reset_request post_api_v1_auth_register post_api_v1_auth_yandex
type SwaggerAuthEmailVerificationConfirmHeaderParams struct {
	// web включает браузерный refresh-cookie режим. Для Swagger/Postman оставьте пустым.
	//
	// in: header
	// Required: false
	// Enum: ["web"]
	XRealgoClient string `json:"X-Realgo-Client"`
	// В web-режиме браузер автоматически передаёт origin; JavaScript не может произвольно изменить этот заголовок.
	//
	// in: header
	// Required: false
	Origin string `json:"Origin"`
}

// swagger:parameters post_api_v1_auth_email_verification_request
type SwaggerAuthEmailVerificationRequestBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body emailVerificationRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_github post_api_v1_auth_yandex
type SwaggerAuthGithubBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body oauthLoginRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_login
type SwaggerAuthLoginBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body credentialsRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_password_reset_confirm
type SwaggerAuthPasswordResetConfirmBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body passwordResetConfirmRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_password_reset_request
type SwaggerAuthPasswordResetRequestBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body passwordResetRequest `json:"body"`
}

// swagger:parameters post_api_v1_auth_register
type SwaggerAuthRegisterBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body registrationRequest `json:"body"`
}

// swagger:parameters delete_api_v1_me
type SwaggerMeBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body deleteMeRequest `json:"body"`
}

// swagger:parameters patch_api_v1_me_notification_settings
type SwaggerNotificationSettingsBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body patchNotificationSettingsRequest `json:"body"`
}

// swagger:parameters post_api_v1_me_password
type SwaggerPasswordBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body changePasswordRequest `json:"body"`
}

// swagger:parameters patch_api_v1_me_profile
type SwaggerProfileBodyParams struct {
	// Один JSON-объект; неизвестные поля отклоняются. По умолчанию предел 1 MiB.
	//
	// in: body
	// Required: true
	Body patchProfileRequest `json:"body"`
}
