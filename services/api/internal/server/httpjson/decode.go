package httpjson

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/mxdtrip/realgo/services/api/internal/server/response"
)

const DefaultMaxBodyBytes int64 = 1 << 20

// DecodeStrict reads exactly one JSON object, rejects unknown fields and
// enforces a small body limit. It writes the API error envelope and returns
// false on invalid input.
func DecodeStrict(w http.ResponseWriter, r *http.Request, dst any, code string) bool {
	return DecodeStrictLimit(w, r, dst, code, DefaultMaxBodyBytes)
}

// DecodeStrictLimit is DecodeStrict with an endpoint-specific body limit.
// Large-but-bounded payloads (for example a compact diagnostic report)
// can opt in without relaxing the default for every JSON endpoint.
func DecodeStrictLimit(w http.ResponseWriter, r *http.Request, dst any, code string, maxBodyBytes int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Fail(w, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE", "request body is too large")
		} else {
			response.Fail(w, http.StatusBadRequest, code, "invalid request body")
		}
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		response.Fail(w, http.StatusBadRequest, code, "request body must contain a single JSON object")
		return false
	}
	return true
}
