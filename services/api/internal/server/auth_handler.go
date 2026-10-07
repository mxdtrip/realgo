package server

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/mail"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

// authHandler exposes the authentication endpoints over the auth service.
type authHandler struct {
	svc                   *auth.Service
	mailer                mail.Sender
	mailBaseURL           string
	skipEmailVerification bool
}

const maxJSONBodyBytes = 1 << 20

const (
	maxPrepGoalRunes    = 100
	maxTargetTextRunes  = 200
	maxTargetTopics     = 50
	maxTargetTopicRunes = 64
)

// credentialsRequest documents the AuthCredentialsRequest JSON shape.
//
// Example: {"email":"qa@example.com","password":"ExamplePass123"}
//
// swagger:model AuthCredentialsRequest
// swagger:additionalProperties false
type credentialsRequest struct {
	// swagger:name email
	// Required: true
	// Min Length: 1
	// swagger:strfmt email
	Email string `json:"email"`
	// Required: true
	// Min Length: 1
	// swagger:name password
	// swagger:strfmt password
	Password string `json:"password"`
	// Принимается для совместимости; login не сохраняет это поле в профиле.
	//
	// Required: false
	Locale string `json:"locale,omitempty"`
	// Принимается для совместимости; login не сохраняет это поле в профиле.
	//
	// Required: false
	Timezone string `json:"timezone,omitempty"`
}

// registrationRequest documents the AuthRegistrationRequest JSON shape.
//
// Example: {"email":"qa@example.com","password":"ExamplePass123","nickname":"qa_tester"}
//
// swagger:model AuthRegistrationRequest
// swagger:additionalProperties false
type registrationRequest struct {
	// swagger:name email
	// Required: true
	// swagger:strfmt email
	Email string `json:"email"`
	// Не менее 8 символов и не более 72 байт UTF-8; ограничение по байтам отличается от числа символов.
	//
	// Required: true
	// Min Length: 8
	// swagger:name password
	// swagger:strfmt password
	Password string `json:"password"`
	// Необязательно. В режиме с email verification непустое значение после trim: 3–32 буквы Unicode, цифры, _ или -. На staging/local handler его не передаёт в RegisterWithoutEmailVerification, поэтому оно не сохраняется.
	//
	// Required: false
	Nickname string `json:"nickname"`
}

// refreshRequest documents the AuthRefreshRequest JSON shape.
//
// Example: {"refresh_token":"<refresh_token>"}
//
// swagger:model AuthRefreshRequest
// swagger:additionalProperties false
type refreshRequest struct {
	// Обязательно для клиента без X-Realgo-Client: web. В браузерном режиме токен берётся из cookie, тело может быть {}.
	//
	// Required: false
	RefreshToken string `json:"refresh_token"`
}

// oauthLoginRequest is the body shape shared by every "second leg" OAuth
// endpoint (/auth/yandex, /auth/github): the callback route forwards the
// authorization code and the exact redirect_uri it was issued for.
// oauthLoginRequest documents the AuthOauthLoginRequest JSON shape.
//
// Example: {"code":"<authorization_code>","redirect_uri":"https://staging.realgo.dev/auth/github/callback"}
//
// swagger:model AuthOauthLoginRequest
// swagger:additionalProperties false
type oauthLoginRequest struct {
	// Required: true
	// Min Length: 1
	Code string `json:"code"`
	// Тот же redirect_uri, для которого провайдер выдал authorization code.
	//
	// Required: true
	// Min Length: 1
	RedirectURI string `json:"redirect_uri"`
}

// profileResponse documents the AuthProfileResponse JSON shape.
//
// swagger:model AuthProfileResponse
type profileResponse struct {
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PrepGoal *string `json:"prep_goal"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Grade *string `json:"grade"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TargetCompany *string `json:"target_company"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TargetPosition *string `json:"target_position"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Platform *string `json:"platform"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TargetTopics []string `json:"target_topics"`
}

// notificationSettingsResponse documents the AuthNotificationSettingsResponse JSON shape.
//
// swagger:model AuthNotificationSettingsResponse
type notificationSettingsResponse struct {
	// Required: true
	ReviewReminder bool `json:"review_reminder"`
	// Required: true
	StreakReminder bool `json:"streak_reminder"`
	// Required: true
	WeeklyDigest bool `json:"weekly_digest"`
	// Required: true
	EmailEnabled bool `json:"email_enabled"`
}

// userResponse documents the AuthUserResponse JSON shape.
//
// swagger:model AuthUserResponse
type userResponse struct {
	// Required: true
	ID int64 `json:"id"`
	// swagger:name email
	// Required: true
	// swagger:strfmt email
	Email string `json:"email"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Nickname *string `json:"nickname"`
	// Required: true
	Timezone string `json:"timezone"`
	// Required: true
	Plan string `json:"plan"`
	// swagger:name interview_date
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	InterviewDate *string `json:"interview_date"`
	// swagger:name created_at
	// Required: true
	// swagger:strfmt date-time
	CreatedAt string `json:"created_at"`
	// Required: true
	OnboardingCompleted bool `json:"onboarding_completed"`
	// Required: true
	Profile profileResponse `json:"profile"`
	// Required: true
	NotificationSettings notificationSettingsResponse `json:"notification_settings"`
}

// authResponse documents the AuthAuthResponse JSON shape.
//
// swagger:model AuthAuthResponse
type authResponse struct {
	// Required: true
	User userResponse `json:"user"`
	// Required: true
	Tokens auth.TokenPair `json:"tokens"`
}

func newUserResponse(u db.User) userResponse {
	resp := userResponse{
		ID:                  u.ID,
		Email:               u.Email,
		Timezone:            u.Timezone.String,
		Plan:                u.Plan.String,
		OnboardingCompleted: u.OnboardingCompletedAt.Valid,
		NotificationSettings: notificationSettingsResponse{
			ReviewReminder: u.NotifyReviewReminder,
			StreakReminder: u.NotifyStreakReminder,
			WeeklyDigest:   u.NotifyWeeklyDigest,
			EmailEnabled:   u.NotifyEmailEnabled,
		},
	}
	if u.CreatedAt.Valid {
		resp.CreatedAt = u.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if u.Nickname.Valid {
		resp.Nickname = &u.Nickname.String
	}
	if u.InterviewDate.Valid {
		d := u.InterviewDate.Time.UTC().Format(time.RFC3339)
		resp.InterviewDate = &d
	}
	if u.PrepGoal.Valid {
		resp.Profile.PrepGoal = &u.PrepGoal.String
	}
	if u.Grade.Valid {
		resp.Profile.Grade = &u.Grade.String
	}
	if u.TargetCompany.Valid {
		resp.Profile.TargetCompany = &u.TargetCompany.String
	}
	if u.TargetPosition.Valid {
		resp.Profile.TargetPosition = &u.TargetPosition.String
	}
	if u.Platform.Valid {
		resp.Profile.Platform = &u.Platform.String
	}
	resp.Profile.TargetTopics = u.TargetTopics
	if resp.Profile.TargetTopics == nil {
		resp.Profile.TargetTopics = []string{} // serialise as [] not null
	}
	return resp
}

// swagger:operation POST /api/v1/auth/register Auth post_api_v1_auth_register
//
// ---
// summary: "Начать регистрацию по email"
// description: "Режим определяется APP_ENV в app.Run: при APP_ENV != production включается SkipEmailVerification, возвращается 201 с user/tokens, подтверждение почты не требуется и nickname из тела не сохраняется. docker-compose.staging.yml задаёт APP_ENV=staging. При APP_ENV=production: 202 с challenge, аккаунт создаётся после подтверждения кода из письма. Повторный запрос письма: /auth/email-verification/request. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 5 запросов за 3600 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 5, "separatePerMethodAndPath": true, "windowSeconds": 3600}
// responses:
//   "201": {$ref: "#/responses/registrationCreated"}
//   "202": {$ref: "#/responses/registrationPending"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "409": {$ref: "#/responses/emailTaken"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/mailUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req registrationRequest
	if !decodeJSON(w, r, &req) || !validateCredentials(w, req.Email, req.Password, "Register") {
		return
	}
	if h.skipEmailVerification {
		user, tokens, err := h.svc.RegisterWithoutEmailVerification(r.Context(), req.Email, req.Password)
		if err != nil {
			writeAuthError(w, err, "Register", slog.String("email_hash", emailLogHash(req.Email)))
			return
		}
		response.JSON(w, http.StatusCreated, authResponse{User: newUserResponse(user), Tokens: h.browserTokens(w, r, tokens)})
		return
	}
	if h.mailUnavailable(w) {
		return
	}
	challenge, err := h.svc.QueueRegistration(r.Context(), req.Email, req.Password, req.Nickname)
	if err != nil {
		writeAuthError(w, err, "Register", slog.String("email_hash", emailLogHash(req.Email)))
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]string{"status": "verification_requested", "challenge": challenge})
}

// swagger:operation POST /api/v1/auth/login Auth post_api_v1_auth_login
//
// ---
// summary: "Войти по email и паролю"
// description: "Войти по email и паролю. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "200": {$ref: "#/responses/authSession"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidCredentials"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	h.handleCredentials(w, r, h.svc.Login, http.StatusOK, "Login")
}

// passwordResetRequest documents the AuthPasswordResetRequest JSON shape.
//
// Example: {"email":"qa@example.com"}
//
// swagger:model AuthPasswordResetRequest
// swagger:additionalProperties false
type passwordResetRequest struct {
	// Укажите email для доставки письма. Ответ одинаков для известного, неизвестного и невалидного email; пустой JSON-объект {} также не раскрывает наличие аккаунта. Полностью отсутствующее тело не является JSON и даёт 400 invalid_request.
	//
	// Required: false
	Email string `json:"email"`
}

// passwordResetConfirmRequest documents the AuthPasswordResetConfirmRequest JSON shape.
//
// Example: {"token":"<reset_token_from_email>","new_password":"NewExamplePass123"}
//
// swagger:model AuthPasswordResetConfirmRequest
// swagger:additionalProperties false
type passwordResetConfirmRequest struct {
	// Required: true
	// Min Length: 1
	Token string `json:"token"`
	// Не более 72 байт UTF-8. Reset-токен действует 30 минут; сброс отзывает активные сессии.
	//
	// Required: true
	// Min Length: 8
	// swagger:name new_password
	// swagger:strfmt password
	NewPassword string `json:"new_password"`
}

// emailVerificationRequest documents the AuthEmailVerificationRequest JSON shape.
//
// Example: {"email":"qa@example.com","challenge":"example_challenge_123456789012345678901234567890"}
//
// swagger:model AuthEmailVerificationRequest
// swagger:additionalProperties false
type emailVerificationRequest struct {
	// Значение challenge из ответа POST /auth/register.
	//
	// Required: false
	Challenge string `json:"challenge"`
	// Email pending-регистрации. Запрос асинхронный; ответ не раскрывает существование аккаунта или challenge.
	//
	// Required: false
	Email string `json:"email"`
}

// emailVerificationConfirmRequest documents the AuthEmailVerificationConfirmRequest JSON shape.
//
// Example: {"email":"qa@example.com","challenge":"example_challenge_123456789012345678901234567890","code":"123456"}
//
// swagger:model AuthEmailVerificationConfirmRequest
// swagger:additionalProperties false
type emailVerificationConfirmRequest struct {
	// Required: true
	// Min Length: 32
	Challenge string `json:"challenge"`
	// swagger:name email
	// Required: true
	// swagger:strfmt email
	Email string `json:"email"`
	// Код из письма. Код действует 10 минут; после trim его длина должна быть 6.
	//
	// Required: true
	// Min Length: 6
	// Max Length: 6
	Code string `json:"code"`
}

// requestPasswordReset is deliberately indistinguishable for known and
// unknown accounts. Logs use an irreversible short hash rather than email.
// swagger:operation POST /api/v1/auth/password-reset/request Auth post_api_v1_auth_password_reset_request
//
// ---
// summary: "Запросить письмо для сброса пароля"
// description: "Ответ 202 одинаков для известного и неизвестного email. Доставка письма асинхронная. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 5 запросов за 3600 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 5, "separatePerMethodAndPath": true, "windowSeconds": 3600}
// responses:
//   "202": {$ref: "#/responses/resetRequested"}
//   "400": {$ref: "#/responses/invalidRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/mailUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req passwordResetRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if h.mailUnavailable(w) {
		return
	}
	if err := h.svc.QueuePasswordReset(r.Context(), req.Email); err != nil {
		writeAuthError(w, err, "QueuePasswordReset")
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]string{"status": "reset_requested"})
}

// swagger:operation POST /api/v1/auth/password-reset/confirm Auth post_api_v1_auth_password_reset_confirm
//
// ---
// summary: "Установить пароль по reset-токену"
// description: "Установить пароль по reset-токену. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 10 запросов за 3600 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 10, "separatePerMethodAndPath": true, "windowSeconds": 3600}
// responses:
//   "200": {$ref: "#/responses/passwordReset"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) confirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req passwordResetConfirmRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Token) == "" || req.NewPassword == "" {
		response.Fail(w, http.StatusBadRequest, "validation_error", "token and new_password are required")
		return
	}
	if _, err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		if errors.Is(err, auth.ErrInvalidToken) {
			slog.Info("password_reset_invalid_token", slog.String("request_id", middleware.GetReqID(r.Context())))
		}
		writeAuthError(w, err, "ConfirmPasswordReset")
		return
	}
	slog.Info("password_reset_completed", slog.String("request_id", middleware.GetReqID(r.Context())))
	response.JSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
}

// swagger:operation POST /api/v1/auth/email-verification/request Auth post_api_v1_auth_email_verification_request
//
// ---
// summary: "Повторно запросить код подтверждения почты"
// description: "Асинхронно ставит resend в очередь. 202 одинаков для валидного и неизвестного challenge/email; доставка письма этим ответом не подтверждается. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 5 запросов за 3600 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 5, "separatePerMethodAndPath": true, "windowSeconds": 3600}
// responses:
//   "202": {$ref: "#/responses/verificationRequested"}
//   "400": {$ref: "#/responses/invalidRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/mailUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) requestEmailVerification(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req emailVerificationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if h.mailUnavailable(w) {
		return
	}
	if err := h.svc.QueueRegistrationResend(r.Context(), req.Email, req.Challenge); err != nil {
		writeAuthError(w, err, "QueueEmailVerification")
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]string{"status": "verification_requested"})
}

// swagger:operation POST /api/v1/auth/email-verification/confirm Auth post_api_v1_auth_email_verification_confirm
//
// ---
// summary: "Подтвердить почту и завершить регистрацию"
// description: "Требуются email, challenge из регистрации и шестизначный код. Создаёт пользователя и сессию. Неверный/истёкший код или уже использованный email: 400 invalid_code. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 10 запросов за 3600 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 10, "separatePerMethodAndPath": true, "windowSeconds": 3600}
// responses:
//   "201": {$ref: "#/responses/authSession"}
//   "400": {$ref: "#/responses/invalidVerificationCode"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) confirmEmailVerification(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req emailVerificationConfirmRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	user, tokens, err := h.svc.CompleteRegistration(r.Context(), req.Email, strings.TrimSpace(req.Code), req.Challenge)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidToken) || errors.Is(err, auth.ErrEmailTaken) {
			slog.Info("email_verification_invalid_code", slog.String("email_hash", emailLogHash(req.Email)), slog.String("request_id", middleware.GetReqID(r.Context())))
			response.Fail(w, http.StatusBadRequest, "invalid_code", "invalid or expired verification code")
			return
		}
		slog.Error("email_verification_confirm_failed", slog.String("email_hash", emailLogHash(req.Email)), slog.String("request_id", middleware.GetReqID(r.Context())), slog.String("reason", "request_failed"))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
		return
	}
	slog.Info("email_verification_completed", slog.Int64("user_id", user.ID), slog.String("request_id", middleware.GetReqID(r.Context())))
	response.JSON(w, http.StatusCreated, authResponse{User: newUserResponse(user), Tokens: h.browserTokens(w, r, tokens)})
}

func (h *authHandler) mailUnavailable(w http.ResponseWriter) bool {
	if h.mailer != nil {
		return false
	}
	response.Fail(w, http.StatusServiceUnavailable, "mail_unavailable", "Отправка писем временно недоступна. Попробуйте позже.")
	return true
}

func emailLogHash(email string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email))))
	return fmt.Sprintf("%x", sum[:])[:16]
}

func (h *authHandler) handleCredentials(
	w http.ResponseWriter,
	r *http.Request,
	fn func(context.Context, string, string) (db.User, auth.TokenPair, error),
	status int,
	method string,
) {
	if h.unavailable(w) {
		return
	}
	req, ok := decodeCredentials(w, r, method)
	if !ok {
		return
	}
	user, tokens, err := fn(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err, method, slog.String("email_hash", emailLogHash(req.Email)))
		return
	}
	response.JSON(w, status, authResponse{User: newUserResponse(user), Tokens: h.browserTokens(w, r, tokens)})
}

// yandexLogin handles POST /auth/yandex — the second leg of "Sign in with
// Yandex ID": the browser has already redirected through
// https://oauth.yandex.ru/authorize and landed back on the app's callback
// route with an authorization code, which it forwards here to be exchanged
// server-side (client_secret never reaches the browser).
// swagger:operation POST /api/v1/auth/yandex Auth post_api_v1_auth_yandex
//
// ---
// summary: "Обменять код Яндекс OAuth на сессию"
// description: "Обменять код Яндекс OAuth на сессию. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "200": {$ref: "#/responses/authSession"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "422": {$ref: "#/responses/oauthNoEmail"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "502": {$ref: "#/responses/oauthProviderError"}
//   "503": {$ref: "#/responses/oauthUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) yandexLogin(w http.ResponseWriter, r *http.Request) {
	h.handleOAuthLogin(w, r, h.svc.LoginWithYandex, "YandexLogin")
}

// githubLogin handles POST /auth/github — the second leg of "Sign in with
// GitHub", mirroring yandexLogin for the GitHub OAuth App authorization code
// flow (https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
// swagger:operation POST /api/v1/auth/github Auth post_api_v1_auth_github
//
// ---
// summary: "Обменять код GitHub OAuth на сессию"
// description: "Обменять код GitHub OAuth на сессию. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "200": {$ref: "#/responses/authSession"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "422": {$ref: "#/responses/oauthNoEmail"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "502": {$ref: "#/responses/oauthProviderError"}
//   "503": {$ref: "#/responses/oauthUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) githubLogin(w http.ResponseWriter, r *http.Request) {
	h.handleOAuthLogin(w, r, h.svc.LoginWithGitHub, "GithubLogin")
}

func (h *authHandler) handleOAuthLogin(
	w http.ResponseWriter,
	r *http.Request,
	fn func(context.Context, string, string) (db.User, auth.TokenPair, error),
	method string,
) {
	if h.unavailable(w) {
		return
	}
	var req oauthLoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Code == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "code"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "code is required", "code")
		return
	}
	if req.RedirectURI == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "redirect_uri"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "redirect_uri is required", "redirect_uri")
		return
	}
	user, tokens, err := fn(r.Context(), req.Code, req.RedirectURI)
	if err != nil {
		writeAuthError(w, err, method)
		return
	}
	response.JSON(w, http.StatusOK, authResponse{User: newUserResponse(user), Tokens: h.browserTokens(w, r, tokens)})
}

// swagger:operation POST /api/v1/auth/refresh Auth post_api_v1_auth_refresh
//
// ---
// summary: "Обновить токены сессии"
// description: "Refresh-токен одноразовый: после обновления используйте новую пару. Возвращает data.tokens. В браузерном режиме требуется соответствующий X-Realgo-Session и refresh-cookie. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "200": {$ref: "#/responses/refreshedTokens"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidToken"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) refresh(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.RefreshToken = h.requestRefreshToken(r, req.RefreshToken)
	if req.RefreshToken == "" {
		slog.Warn("auth: Refresh failed", slog.String("field", "refresh_token"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "refresh_token is required", "refresh_token")
		return
	}
	tokens, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeAuthError(w, err, "Refresh")
		return
	}
	response.JSON(w, http.StatusOK, map[string]auth.TokenPair{"tokens": h.browserTokens(w, r, tokens)})
}

// deviceSession exchanges an already authenticated access token for an
// independent refresh session. It lets the browser extension avoid sharing the
// web app's one-time rotating refresh token.
// swagger:operation POST /api/v1/auth/device-session Auth post_api_v1_auth_device_session
//
// ---
// summary: "Создать отдельную сессию для устройства"
// description: "Требует Bearer access token и действующий parent refresh token той же сессии; создаёт независимую refresh-сессию для расширения. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// security:
// - BearerAuth: []
// x-rate-limit: {"identity": "ID пользователя из контекста после requireAuth.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "201": {$ref: "#/responses/deviceSession"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidDeviceSession"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) deviceSession(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	parentRefresh := h.requestRefreshToken(r, req.RefreshToken)
	tokens, err := h.svc.NewSessionFromAccess(r.Context(), strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), parentRefresh)
	if err != nil {
		writeAuthError(w, err, "DeviceSession", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusCreated, map[string]auth.TokenPair{"tokens": h.browserTokens(w, r, tokens)})
}

// swagger:operation POST /api/v1/auth/logout Auth post_api_v1_auth_logout
//
// ---
// summary: "Выйти из refresh-сессии"
// description: "Bearеr access token не требуется; используется refresh token из тела или браузерной cookie. Поэтому logout доступен и с истёкшим access token. При X-Realgo-Client: web проверяется Origin, в точности равный origin MAIL_BASE_URL; иначе 403 csrf_rejected. Refresh хранится в HttpOnly SameSite=Strict cookie __Host-realgo-refresh-<session_id> (HTTPS) или realgo-refresh-<session_id> (HTTP). В обычном Swagger/Postman режиме этот заголовок не нужен. Лимит: 20 запросов за 60 секунд на метод/путь и identity; зависит от наличия Redis."
// x-rate-limit: {"identity": "IP клиента: эти маршруты не выполняют requireAuth, даже если прислан заголовок Bearer.", "requests": 20, "separatePerMethodAndPath": true, "windowSeconds": 60}
// responses:
//   "200": {$ref: "#/responses/loggedOut"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "403": {$ref: "#/responses/csrfRejected"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "429": {$ref: "#/responses/rateLimited"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authRateLimitUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.RefreshToken = h.requestRefreshToken(r, req.RefreshToken)
	if req.RefreshToken == "" {
		slog.Warn("auth: Logout failed", slog.String("field", "refresh_token"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "refresh_token is required", "refresh_token")
		return
	}
	if err := h.svc.Logout(r.Context(), req.RefreshToken); err != nil {
		slog.Error("auth: Logout failed", slog.String("reason", "request_failed"))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not log out")
		return
	}
	h.clearBrowserCookie(w, r)
	response.JSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

// swagger:operation GET /api/v1/me Account get_api_v1_me
//
// ---
// summary: "Получить текущего пользователя"
// description: "Получить текущего пользователя."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/userDataResponse"}
//   "401": {$ref: "#/responses/invalidAuthSession"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("auth: Me failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	user, err := h.svc.UserByID(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err, "Me", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

func (h *authHandler) unavailable(w http.ResponseWriter) bool {
	if h.svc != nil {
		return false
	}
	slog.Error("auth: request failed", slog.String("reason", "auth service unavailable"))
	response.Fail(w, http.StatusServiceUnavailable, "auth_unavailable", "authentication service is not configured")
	return true
}

func decodeCredentials(w http.ResponseWriter, r *http.Request, method string) (credentialsRequest, bool) {
	var req credentialsRequest
	if !decodeJSON(w, r, &req) {
		return req, false
	}
	if !validateCredentials(w, req.Email, req.Password, method) {
		return req, false
	}
	return req, true
}

func validateCredentials(w http.ResponseWriter, email, password, method string) bool {
	if email == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "email"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "email is required", "email")
		return false
	}
	if password == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "password"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password is required", "password")
		return false
	}
	return true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			slog.Warn("auth: decodeJSON failed", slog.String("reason", "request_failed"))
			response.Fail(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body is too large")
		} else {
			slog.Warn("auth: decodeJSON failed", slog.String("reason", "request_failed"))
			response.Fail(w, http.StatusBadRequest, "invalid_request", "request body is not valid JSON")
		}
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		slog.Warn("auth: decodeJSON failed", slog.String("reason", "multiple JSON values in body"))
		response.Fail(w, http.StatusBadRequest, "invalid_request", "request body must contain a single JSON object")
		return false
	}
	return true
}

// optionalNullableString tracks JSON field presence internally; the public
// profile schema documents its wire value as a nullable RFC3339 string.
// swagger:ignore
type optionalNullableString struct {
	Set   bool
	Value *string
}

func (value *optionalNullableString) UnmarshalJSON(data []byte) error {
	value.Set = true
	if strings.TrimSpace(string(data)) == "null" {
		value.Value = nil
		return nil
	}

	var decoded string
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.Value = &decoded
	return nil
}

// patchProfileRequest documents the AuthPatchProfileRequest JSON shape.
//
// Example: {"timezone":"Asia/Yekaterinburg","interview_date":"2026-12-01T12:00:00Z","grade":"junior","platform":"leetcode","target_topics":["arrays","two_pointers"],"onboarding_completed":true}
//
// swagger:model AuthPatchProfileRequest
// swagger:additionalProperties false
type patchProfileRequest struct {
	// IANA timezone, например Europe/Moscow. Local не допускается; пустая строка допускается обработчиком.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Timezone *string `json:"timezone"`
	// swagger:name interview_date
	// RFC3339 или null для очистки даты. Отсутствие поля сохраняет прежнее значение.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	// swagger:type string
	InterviewDate optionalNullableString `json:"interview_date"`
	// Required: false
	// Max Length: 100
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PrepGoal *string `json:"prep_goal"`
	// Required: false
	// Enum: ["", "junior", "middle", "senior", "staff", "principal"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Grade *string `json:"grade"`
	// Required: false
	// Max Length: 200
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TargetCompany *string `json:"target_company"`
	// Required: false
	// Max Length: 200
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TargetPosition *string `json:"target_position"`
	// Required: false
	// Enum: ["leetcode", "geeksforgeeks", "hackerrank", "codeforces"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Platform *string `json:"platform"`
	// До 50 значений по 64 символа. Backend делает trim, lowercase, заменяет - на _, удаляет пустые значения и дубликаты.
	//
	// Required: false
	// Max Items: 50
	// Extensions:
	// ---
	// x-nullable: true
	// x-doc-items-max-length: 64
	// ---
	TargetTopics *[]string `json:"target_topics"`
	// true отмечает завершение onboarding; false не очищает уже установленную отметку.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	OnboardingCompleted *bool `json:"onboarding_completed"`
}

var validGrades = map[string]bool{
	"junior": true, "middle": true, "senior": true, "staff": true, "principal": true,
}

// validPlatforms mirrors the CHECK constraint on users.platform (migration
// 000016) and the catalog the web onboarding/settings selector offers
// (apps/web/app/_profile/platforms.ts) — all 4 have a submit-detection
// adapter in the extension (apps/extension/src/platforms).
var validPlatforms = map[string]bool{
	"leetcode": true, "geeksforgeeks": true, "hackerrank": true, "codeforces": true,
}

// validTimezone accepts IANA zone names (e.g. "Europe/Moscow", "UTC"). The
// value ends up in Postgres `AT TIME ZONE` expressions (dashboard metrics), so
// an unvalidated string would make those queries fail with a database error on
// every request for that user. Go's "Local" pseudo-zone is rejected for the
// same reason: Postgres does not recognise it.
func validTimezone(tz string) bool {
	if tz == "Local" {
		return false
	}
	_, err := time.LoadLocation(tz)
	return err == nil
}

// normaliseTopics lowercases topic codes and converts dashes to underscores,
// so "two-pointers" from the web onboarding becomes the canonical "two_pointers"
// used across roadmap weeks and Pattern Atlas. Empty entries are dropped.
func normaliseTopics(in []string) ([]string, error) {
	if len(in) > maxTargetTopics {
		return nil, errors.New("too many target topics")
	}
	out := make([]string, 0, len(in))
	seen := make(map[string]struct{}, len(in))
	for _, t := range in {
		t = strings.ToLower(strings.TrimSpace(t))
		t = strings.ReplaceAll(t, "-", "_")
		if t == "" {
			continue
		}
		if utf8.RuneCountInString(t) > maxTargetTopicRunes {
			return nil, errors.New("target topic is too long")
		}
		if _, exists := seen[t]; exists {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out, nil
}

// patchProfile handles PATCH /me/profile — a partial update of the onboarding
// profile. Omitted fields are left untouched; interview_date:null explicitly
// clears the date while an RFC3339 string replaces it.
// swagger:operation PATCH /api/v1/me/profile Account patch_api_v1_me_profile
//
// ---
// summary: "Обновить профиль и onboarding"
// description: "Частичное обновление. PATCH {} допустим. interview_date:null очищает дату. Формат профиля использует snake_case."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/userDataResponse"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidAuthSession"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) patchProfile(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("auth: PatchProfile failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req patchProfileRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Grade != nil && *req.Grade != "" && !validGrades[*req.Grade] {
		slog.Warn("auth: PatchProfile failed", slog.Int64("user_id", userID), slog.String("field", "grade"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "grade must be one of: junior, middle, senior, staff, principal", "grade")
		return
	}
	if req.Timezone != nil && *req.Timezone != "" && !validTimezone(*req.Timezone) {
		slog.Warn("auth: PatchProfile failed", slog.Int64("user_id", userID), slog.String("field", "timezone"))
		response.Fail(w, http.StatusBadRequest, "validation_error", "timezone must be a valid IANA time zone, e.g. Europe/Moscow")
		return
	}
	if req.Platform != nil && !validPlatforms[*req.Platform] {
		slog.Warn("auth: PatchProfile failed", slog.Int64("user_id", userID), slog.String("field", "platform"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "platform must be one of: leetcode, geeksforgeeks, hackerrank, codeforces", "platform")
		return
	}
	if req.PrepGoal != nil && utf8.RuneCountInString(*req.PrepGoal) > maxPrepGoalRunes {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "prep_goal must be at most 100 characters", "prep_goal")
		return
	}
	if req.TargetCompany != nil && utf8.RuneCountInString(*req.TargetCompany) > maxTargetTextRunes {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "target_company must be at most 200 characters", "target_company")
		return
	}
	if req.TargetPosition != nil && utf8.RuneCountInString(*req.TargetPosition) > maxTargetTextRunes {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "target_position must be at most 200 characters", "target_position")
		return
	}

	upd := auth.ProfileUpdate{
		Timezone:       req.Timezone,
		PrepGoal:       req.PrepGoal,
		Grade:          req.Grade,
		TargetCompany:  req.TargetCompany,
		TargetPosition: req.TargetPosition,
		Platform:       req.Platform,
	}
	if req.TargetTopics != nil {
		normalised, err := normaliseTopics(*req.TargetTopics)
		if err != nil {
			response.FailWithDetails(w, http.StatusBadRequest, "validation_error", err.Error(), "target_topics")
			return
		}
		upd.TargetTopics = &normalised
	}
	if req.InterviewDate.Set {
		if req.InterviewDate.Value == nil {
			upd.ClearInterviewDate = true
		} else {
			t, err := time.Parse(time.RFC3339, *req.InterviewDate.Value)
			if err != nil {
				slog.Warn("auth: PatchProfile failed", slog.Int64("user_id", userID), slog.String("reason", "request_failed"), slog.String("field", "interview_date"))
				response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "interview_date must be RFC3339 or null", "interview_date")
				return
			}
			upd.InterviewDate = &t
		}
	}
	if req.OnboardingCompleted != nil && *req.OnboardingCompleted {
		upd.SetOnboardingDone = true
	}

	user, err := h.svc.UpdateProfile(r.Context(), userID, upd)
	if err != nil {
		writeAuthError(w, err, "PatchProfile", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

// patchNotificationSettingsRequest documents the AuthPatchNotificationSettingsRequest JSON shape.
//
// Нужно хотя бы одно непустое (не null) поле.
//
// Example: {"review_reminder":true,"email_enabled":false}
// Extensions:
// ---
// x-anyOf: [{"required":["review_reminder"],"properties":{"review_reminder":{"type":"boolean"}}},{"required":["streak_reminder"],"properties":{"streak_reminder":{"type":"boolean"}}},{"required":["weekly_digest"],"properties":{"weekly_digest":{"type":"boolean"}}},{"required":["email_enabled"],"properties":{"email_enabled":{"type":"boolean"}}}]
// ---
//
// swagger:model AuthPatchNotificationSettingsRequest
// swagger:additionalProperties false
type patchNotificationSettingsRequest struct {
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ReviewReminder *bool `json:"review_reminder"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	StreakReminder *bool `json:"streak_reminder"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	WeeklyDigest *bool `json:"weekly_digest"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	EmailEnabled *bool `json:"email_enabled"`
}

// changePasswordRequest documents the AuthChangePasswordRequest JSON shape.
//
// Example: {"current_password":"ExamplePass123","new_password":"NewExamplePass123"}
//
// swagger:model AuthChangePasswordRequest
// swagger:additionalProperties false
type changePasswordRequest struct {
	// Required: true
	// Min Length: 1
	// swagger:name current_password
	// swagger:strfmt password
	CurrentPassword string `json:"current_password"`
	// Не более 72 байт UTF-8. Изменение пароля отзывает активные сессии.
	//
	// Required: true
	// Min Length: 8
	// swagger:name new_password
	// swagger:strfmt password
	NewPassword string `json:"new_password"`
}

// swagger:operation POST /api/v1/me/password Account post_api_v1_me_password
//
// ---
// summary: "Изменить пароль"
// description: "Изменить пароль."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/passwordChanged"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidAccountCredentials"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) changePassword(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var req changePasswordRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		response.Fail(w, http.StatusBadRequest, "validation_error", "current_password and new_password are required")
		return
	}
	if err := h.svc.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		writeAuthError(w, err, "ChangePassword", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "password_changed"})
}

// swagger:operation POST /api/v1/me/sessions/revoke Account post_api_v1_me_sessions_revoke
//
// ---
// summary: "Отозвать все сессии пользователя"
// description: "Отозвать все сессии пользователя."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/sessionsRevoked"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) revokeAllSessions(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if err := h.svc.RevokeAllSessions(r.Context(), userID); err != nil {
		writeAuthError(w, err, "RevokeAllSessions", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "sessions_revoked"})
}

// patchNotificationSettings handles PATCH /me/notification-settings.
// swagger:operation PATCH /api/v1/me/notification-settings Account patch_api_v1_me_notification_settings
//
// ---
// summary: "Обновить настройки уведомлений"
// description: "Нужно хотя бы одно не-null поле. Ответ содержит data.user, а не отдельный объект notification-settings. Отдельный GET /me/notification-settings не зарегистрирован."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/userDataResponse"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidAuthSession"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) patchNotificationSettings(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("auth: PatchNotificationSettings failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req patchNotificationSettingsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.ReviewReminder == nil && req.StreakReminder == nil && req.WeeklyDigest == nil && req.EmailEnabled == nil {
		slog.Warn("auth: PatchNotificationSettings failed", slog.Int64("user_id", userID))
		response.Fail(w, http.StatusBadRequest, "validation_error", "at least one field is required")
		return
	}

	user, err := h.svc.UpdateNotificationSettings(r.Context(), userID, auth.NotificationSettings{
		ReviewReminder: req.ReviewReminder,
		StreakReminder: req.StreakReminder,
		WeeklyDigest:   req.WeeklyDigest,
		EmailEnabled:   req.EmailEnabled,
	})
	if err != nil {
		writeAuthError(w, err, "PatchNotificationSettings", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

// postExport handles POST /me/export. MVP stub: real generation and email
// delivery are post-MVP; the endpoint acknowledges the request only.
// swagger:operation POST /api/v1/me/export Account post_api_v1_me_export
//
// ---
// summary: "Запросить экспорт данных (заглушка)"
// description: "Текущая реализация только подтверждает запрос: data.status=accepted, message=\"data export is not implemented yet\". Файл экспорта не создаётся; GET /me/export/{exportId} не зарегистрирован."
// security:
// - BearerAuth: []
// responses:
//   "202": {$ref: "#/responses/exportAccepted"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) postExport(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		slog.Warn("auth: PostExport failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]string{
		"status":  "accepted",
		"message": "data export is not implemented yet",
	})
}

// deleteMeRequest documents the AuthDeleteMeRequest JSON shape.
//
// Example: {"password":"ExamplePass123"}
//
// swagger:model AuthDeleteMeRequest
// swagger:additionalProperties false
type deleteMeRequest struct {
	// Required: true
	// Min Length: 1
	// swagger:name password
	// swagger:strfmt password
	Password string `json:"password"`
	// Поле для совместимости. Удаление аккаунта отзывает все сессии независимо от него.
	//
	// Required: false
	RefreshToken string `json:"refresh_token"`
}

// deleteMe handles DELETE /me. Account removal is irreversible, so it requires
// the current password for confirmation.
// swagger:operation DELETE /api/v1/me Account delete_api_v1_me
//
// ---
// summary: "Удалить аккаунт с подтверждением пароля"
// description: "Удаление подтверждается текущим password, поле confirm не поддерживается. Все сессии отзываются. Для OAuth-only пользователя без password hash эта проверка не проходит."
// security:
// - BearerAuth: []
// responses:
//   "200": {$ref: "#/responses/accountDeleted"}
//   "400": {$ref: "#/responses/invalidAuthRequest"}
//   "401": {$ref: "#/responses/invalidAccountCredentials"}
//   "413": {$ref: "#/responses/authRequestTooLarge"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

func (h *authHandler) deleteMe(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("auth: DeleteMe failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req deleteMeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Password == "" {
		slog.Warn("auth: DeleteMe failed", slog.Int64("user_id", userID), slog.String("field", "password"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password is required to delete the account", "password")
		return
	}

	if err := h.svc.DeleteAccount(r.Context(), userID, req.Password, req.RefreshToken); err != nil {
		writeAuthError(w, err, "DeleteMe", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func writeAuthError(w http.ResponseWriter, err error, handler string, extra ...any) {
	logArgs := append([]any{slog.String("reason", "request_failed")}, extra...)
	switch {
	case errors.Is(err, auth.ErrInvalidEmail):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "email is not valid", "email")
	case errors.Is(err, auth.ErrWeakPassword):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password must be at least 8 characters", "password")
	case errors.Is(err, auth.ErrPasswordTooLong):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password must be at most 72 bytes", "password")
	case errors.Is(err, auth.ErrInvalidNickname):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "nickname must be 3–32 letters, digits, _ or -", "nickname")
	case errors.Is(err, auth.ErrEmailTaken):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusConflict, "email_taken", "email is already registered", "email")
	case errors.Is(err, auth.ErrInvalidCredentials):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	case errors.Is(err, auth.ErrInvalidToken):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusUnauthorized, "invalid_token", "invalid or expired token")
	case errors.Is(err, auth.ErrOAuthUnavailable):
		slog.Error("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusServiceUnavailable, "oauth_unavailable", "this sign-in method is not configured")
	case errors.Is(err, auth.ErrOAuthNoEmail):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusUnprocessableEntity, "oauth_no_email", "the provider account has no email to sign in with")
	case errors.Is(err, auth.ErrOAuthProviderFailed):
		slog.Error("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusBadGateway, "oauth_provider_failed", "the sign-in provider did not respond as expected")
	default:
		slog.Error("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
	}
}
