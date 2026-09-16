package server

import (
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/mxdtrip/realgo/services/api/internal/auth"
	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

var sessionIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

func browserClient(r *http.Request) bool { return r.Header.Get("X-Realgo-Client") == "web" }

// Cookies are used only by explicit browser requests, which must carry an
// exact allowed Origin and a custom header. Bearer extension clients never
// fall back to browser cookies. Session-specific names isolate late responses
// from a different login; the non-secret selector is not a credential.
func (h *authHandler) browserSessionGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if browserClient(r) {
			expected, err := url.Parse(h.mailBaseURL)
			origin := r.Header.Get("Origin")
			allowed := err == nil && expected.Host != "" && origin == expected.Scheme+"://"+expected.Host
			if !allowed {
				response.Fail(w, http.StatusForbidden, "csrf_rejected", "request origin is not allowed")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func (h *authHandler) cookieName(sid string) string {
	if strings.HasPrefix(h.mailBaseURL, "https://") {
		return "__Host-realgo-refresh-" + sid
	}
	return "realgo-refresh-" + sid
}
func (h *authHandler) browserTokens(w http.ResponseWriter, r *http.Request, tokens auth.TokenPair) auth.TokenPair {
	if !browserClient(r) {
		return tokens
	}
	http.SetCookie(w, &http.Cookie{Name: h.cookieName(tokens.SessionID), Value: tokens.RefreshToken, Path: "/", HttpOnly: true, Secure: strings.HasPrefix(h.mailBaseURL, "https://"), SameSite: http.SameSiteStrictMode, MaxAge: h.svc.RefreshCookieMaxAge()})
	tokens.RefreshToken = ""
	return tokens
}
func (h *authHandler) requestRefreshToken(r *http.Request, body string) string {
	if !browserClient(r) {
		return body
	}
	sid := r.Header.Get("X-Realgo-Session")
	if !sessionIDPattern.MatchString(sid) {
		return ""
	}
	cookie, err := r.Cookie(h.cookieName(sid))
	if err != nil {
		return ""
	}
	return cookie.Value
}
func (h *authHandler) clearBrowserCookie(w http.ResponseWriter, r *http.Request) {
	sid := r.Header.Get("X-Realgo-Session")
	if !browserClient(r) || !sessionIDPattern.MatchString(sid) {
		return
	}
	http.SetCookie(w, &http.Cookie{Name: h.cookieName(sid), Value: "", Path: "/", HttpOnly: true, Secure: strings.HasPrefix(h.mailBaseURL, "https://"), SameSite: http.SameSiteStrictMode, MaxAge: -1})
}
