package reports

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func validRequest() Request {
	return Request{
		SchemaVersion: 2,
		Description:   "Session stays on loading",
		ReportedAt:    "2026-08-14T00:00:00Z",
		Page:          Page{Route: "/dashboard", Viewport: Viewport{Width: 820, Height: 420}, Locale: "ru", Timezone: "Europe/Moscow", Online: true},
		Browser:       Client{Name: "Safari", Version: "18.6", Engine: "WebKit"},
		OS:            Client{Name: "macOS", Version: "10.15.7"},
		Network:       &Network{Method: "GET", Endpoint: "/api/v1/me", Status: json.RawMessage("504"), ResponseTimeMS: 1000, StartedAt: "2026-08-14T00:00:00Z", RequestID: "req-api"},
		Breadcrumbs:   []Breadcrumb{{Time: "00:00:00", Type: "navigation", To: "/dashboard"}},
		Errors:        []ClientError{{Time: "2026-08-14T00:00:00Z", Type: "error", Message: "boom", Stack: "Error: boom\n at load (/app.js:10:2)"}},
		Release:       Release{Version: "1.2.3", Commit: "abcdef"},
	}
}

func TestNormalizeBuildsServerFingerprintAndDropsScreenshotDataFromDiagnostics(t *testing.T) {
	req := validRequest()
	input, err := Normalize(req, "request-report")
	require.NoError(t, err)
	require.Len(t, input.Fingerprint, 64)
	require.Equal(t, "request-report", input.SourceRequestID)
	require.NotContains(t, string(input.Diagnostics), "data:image")
	require.NotContains(t, string(input.Diagnostics), req.Description)
}

func TestFingerprintGroupsLineNumberChanges(t *testing.T) {
	a := validRequest()
	b := validRequest()
	b.Errors[0].Stack = "Error: boom\n at load (/app.js:999:42)"
	require.Equal(t, Fingerprint(a), Fingerprint(b))
}

func TestNormalizeRejectsOversizedAndMismatchedScreenshot(t *testing.T) {
	req := validRequest()
	req.Screenshot = &Screenshot{DataURL: "data:image/png;base64," + strings.Repeat("YQ==", 2), Width: 100, Height: 100}
	_, err := Normalize(req, "request-report")
	require.ErrorIs(t, err, ErrValidation)
}

func TestNormalizeAcceptsMatchingJPEGAndStoresBinarySeparately(t *testing.T) {
	var encoded bytes.Buffer
	pixel := image.NewRGBA(image.Rect(0, 0, 1, 1))
	pixel.Set(0, 0, color.RGBA{R: 20, G: 30, B: 40, A: 255})
	require.NoError(t, jpeg.Encode(&encoded, pixel, nil))
	req := validRequest()
	req.Screenshot = &Screenshot{
		DataURL: "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(encoded.Bytes()),
		Width:   1, Height: 1,
	}
	input, err := Normalize(req, "request-report")
	require.NoError(t, err)
	require.Equal(t, encoded.Bytes(), input.Screenshot)
	require.Equal(t, "image/jpeg", input.ScreenshotMIME)
	require.NotContains(t, string(input.Diagnostics), "base64")
}

func TestNormalizeRejectsTooManyBreadcrumbs(t *testing.T) {
	req := validRequest()
	for len(req.Breadcrumbs) <= MaxBreadcrumbs {
		req.Breadcrumbs = append(req.Breadcrumbs, Breadcrumb{Time: "00:00:00", Type: "click", Target: "button"})
	}
	_, err := Normalize(req, "request-report")
	require.ErrorIs(t, err, ErrValidation)
}
