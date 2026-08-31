package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/mail"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

// authHandler exposes the authentication endpoints over the auth service.
type authHandler struct {
	svc         *auth.Service
	mailer      mail.Sender
	mailBaseURL string
}

const maxJSONBodyBytes = 1 << 20

const (
	maxPrepGoalRunes    = 100
	maxTargetTextRunes  = 200
	maxTargetTopics     = 50
	maxTargetTopicRunes = 64
)

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Locale   string `json:"locale,omitempty"`
	Timezone string `json:"timezone,omitempty"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type profileResponse struct {
	PrepGoal       *string  `json:"prep_goal"`
	Grade          *string  `json:"grade"`
	TargetCompany  *string  `json:"target_company"`
	TargetPosition *string  `json:"target_position"`
	Platform       *string  `json:"platform"`
	TargetTopics   []string `json:"target_topics"`
}

type notificationSettingsResponse struct {
	ReviewReminder bool `json:"review_reminder"`
	StreakReminder bool `json:"streak_reminder"`
	WeeklyDigest   bool `json:"weekly_digest"`
	EmailEnabled   bool `json:"email_enabled"`
}

type userResponse struct {
	ID                   int64                        `json:"id"`
	Email                string                       `json:"email"`
	Timezone             string                       `json:"timezone"`
	Plan                 string                       `json:"plan"`
	InterviewDate        *string                      `json:"interview_date"`
	CreatedAt            string                       `json:"created_at"`
	OnboardingCompleted  bool                         `json:"onboarding_completed"`
	Profile              profileResponse              `json:"profile"`
	NotificationSettings notificationSettingsResponse `json:"notification_settings"`
}

type authResponse struct {
	User   userResponse   `json:"user"`
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

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	h.handleCredentials(w, r, h.svc.Register, http.StatusCreated, "Register")
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	h.handleCredentials(w, r, h.svc.Login, http.StatusOK, "Login")
}

type passwordResetRequest struct {
	Email string `json:"email"`
}

type passwordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

// requestPasswordReset deliberately returns the same success response for
// unknown addresses. This prevents the endpoint from becoming an account
// enumeration oracle.
func (h *authHandler) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req passwordResetRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	user, token, found, err := h.svc.IssuePasswordReset(r.Context(), req.Email)
	if err != nil {
		slog.Error("auth: request password reset failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
		return
	}
	if found {
		message, renderErr := mail.RenderPasswordReset(mail.PasswordResetData{
			Email:     user.Email,
			ExpiresIn: strconv.Itoa(int(auth.PasswordResetTTL / time.Minute)),
			ResetURL:  h.resetURL(token),
		}, h.mailBaseURL)
		if renderErr != nil {
			slog.Error("auth: render password reset email failed", slog.Int64("user_id", user.ID), slog.Any("err", renderErr))
		} else {
			message.To = user.Email
			h.deliverMail(message, user.ID, "password_reset")
		}
	}
	response.JSON(w, http.StatusAccepted, map[string]string{"status": "reset_requested"})
}

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
	user, err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword)
	if err != nil {
		writeAuthError(w, err, "ConfirmPasswordReset")
		return
	}
	h.sendPasswordChanged(r, user)
	response.JSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
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
		writeAuthError(w, err, method, slog.String("email", req.Email))
		return
	}
	response.JSON(w, status, authResponse{User: newUserResponse(user), Tokens: tokens})
}

func (h *authHandler) refresh(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
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
	response.JSON(w, http.StatusOK, map[string]auth.TokenPair{"tokens": tokens})
}

// deviceSession exchanges an already authenticated access token for an
// independent refresh session. It lets the browser extension avoid sharing the
// web app's one-time rotating refresh token.
func (h *authHandler) deviceSession(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	tokens, err := h.svc.NewSession(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err, "DeviceSession", slog.Int64("user_id", userID))
		return
	}
	response.JSON(w, http.StatusCreated, map[string]auth.TokenPair{"tokens": tokens})
}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RefreshToken == "" {
		slog.Warn("auth: Logout failed", slog.String("field", "refresh_token"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "refresh_token is required", "refresh_token")
		return
	}
	if err := h.svc.Logout(r.Context(), req.RefreshToken); err != nil {
		slog.Error("auth: Logout failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not log out")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

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
	if req.Email == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "email"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "email is required", "email")
		return req, false
	}
	if req.Password == "" {
		slog.Warn("auth: "+method+" failed", slog.String("field", "password"))
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password is required", "password")
		return req, false
	}
	return req, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			slog.Warn("auth: decodeJSON failed", slog.Any("err", err))
			response.Fail(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body is too large")
		} else {
			slog.Warn("auth: decodeJSON failed", slog.Any("err", err))
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

type patchProfileRequest struct {
	Timezone            *string                `json:"timezone"`
	InterviewDate       optionalNullableString `json:"interview_date"`
	PrepGoal            *string                `json:"prep_goal"`
	Grade               *string                `json:"grade"`
	TargetCompany       *string                `json:"target_company"`
	TargetPosition      *string                `json:"target_position"`
	Platform            *string                `json:"platform"`
	TargetTopics        *[]string              `json:"target_topics"`
	OnboardingCompleted *bool                  `json:"onboarding_completed"`
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
				slog.Warn("auth: PatchProfile failed", slog.Int64("user_id", userID), slog.Any("err", err), slog.String("field", "interview_date"))
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

type patchNotificationSettingsRequest struct {
	ReviewReminder *bool `json:"review_reminder"`
	StreakReminder *bool `json:"streak_reminder"`
	WeeklyDigest   *bool `json:"weekly_digest"`
	EmailEnabled   *bool `json:"email_enabled"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

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
	user, err := h.svc.UserByID(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err, "ChangePassword", slog.Int64("user_id", userID))
		return
	}
	if err := h.svc.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		writeAuthError(w, err, "ChangePassword", slog.Int64("user_id", userID))
		return
	}
	h.sendPasswordChanged(r, user)
	response.JSON(w, http.StatusOK, map[string]string{"status": "password_changed"})
}

func (h *authHandler) sendPasswordChanged(r *http.Request, user db.User) {
	message, err := mail.RenderPasswordChanged(mail.PasswordResetData{
		Email:       user.Email,
		ChangedAt:   time.Now().UTC().Format("02 January 2006, 15:04 MST"),
		Device:      truncateHeader(r.UserAgent(), 120),
		Region:      clientIP(r),
		RecoveryURL: strings.TrimRight(h.mailBaseURL, "/") + "/reset-password",
	}, h.mailBaseURL)
	if err != nil {
		slog.Error("auth: render password changed email failed", slog.Int64("user_id", user.ID), slog.Any("err", err))
		return
	}
	message.To = user.Email
	h.deliverMail(message, user.ID, "password_changed")
}

func (h *authHandler) deliverMail(message mail.Message, userID int64, kind string) {
	if h.mailer == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := h.mailer.Send(ctx, message); err != nil {
		slog.Error("auth: email delivery failed", slog.Int64("user_id", userID), slog.String("kind", kind), slog.Any("err", err))
	}
}

func (h *authHandler) resetURL(token string) string {
	return strings.TrimRight(h.mailBaseURL, "/") + "/reset-password?token=" + url.QueryEscape(token)
}

func truncateHeader(value string, limit int) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "Не определено"
	}
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}

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

type deleteMeRequest struct {
	Password     string `json:"password"`
	RefreshToken string `json:"refresh_token"`
}

// deleteMe handles DELETE /me. Account removal is irreversible, so it requires
// the current password for confirmation.
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
	logArgs := append([]any{slog.Any("err", err)}, extra...)
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
	case errors.Is(err, auth.ErrEmailTaken):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.FailWithDetails(w, http.StatusConflict, "email_taken", "email is already registered", "email")
	case errors.Is(err, auth.ErrInvalidCredentials):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	case errors.Is(err, auth.ErrInvalidToken):
		slog.Warn("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusUnauthorized, "invalid_token", "invalid or expired token")
	default:
		slog.Error("auth: "+handler+" failed", logArgs...)
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
	}
}
