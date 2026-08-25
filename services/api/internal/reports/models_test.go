package reports

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
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

func TestNormalizeBuildsServerFingerprintAndDropsAttachmentDataFromDiagnostics(t *testing.T) {
	req := validRequest()
	input, err := Normalize(req, "request-report", nil)
	require.NoError(t, err)
	require.Len(t, input.Fingerprint, 64)
	require.Equal(t, "request-report", input.SourceRequestID)
	require.Nil(t, input.Attachment)
	require.NotContains(t, string(input.Diagnostics), req.Description)
}

func TestFingerprintGroupsLineNumberChanges(t *testing.T) {
	a := validRequest()
	b := validRequest()
	b.Errors[0].Stack = "Error: boom\n at load (/app.js:999:42)"
	require.Equal(t, Fingerprint(a), Fingerprint(b))
}

func TestNormalizeRejectsUnsupportedAttachment(t *testing.T) {
	req := validRequest()
	_, err := Normalize(req, "request-report", &AttachmentUpload{
		Filename:    "archive.zip",
		ContentType: "application/zip",
		Data:        []byte("PK\x03\x04"),
	})
	require.ErrorIs(t, err, ErrValidation)
}

func TestNormalizeRejectsOversizedPhotoAttachment(t *testing.T) {
	req := validRequest()
	_, err := Normalize(req, "request-report", &AttachmentUpload{
		Filename:    "photo.jpg",
		ContentType: "image/jpeg",
		Data:        bytes.Repeat([]byte{0xff}, MaxPhotoAttachmentBytes+1),
	})
	require.ErrorIs(t, err, ErrValidation)
}

func TestNormalizeAcceptsJPEGAttachmentAndStoresBinarySeparately(t *testing.T) {
	var encoded bytes.Buffer
	pixel := image.NewRGBA(image.Rect(0, 0, 1, 1))
	pixel.Set(0, 0, color.RGBA{R: 20, G: 30, B: 40, A: 255})
	require.NoError(t, jpeg.Encode(&encoded, pixel, nil))
	req := validRequest()
	input, err := Normalize(req, "request-report", &AttachmentUpload{
		Filename:    "failure.jpg",
		ContentType: "image/jpeg",
		Data:        encoded.Bytes(),
	})
	require.NoError(t, err)
	require.Equal(t, encoded.Bytes(), input.Attachment)
	require.Equal(t, "image/jpeg", input.AttachmentMIME)
	require.Equal(t, "failure.jpg", input.AttachmentName)
	require.Equal(t, int32(encoded.Len()), input.AttachmentSize)
	require.NotContains(t, string(input.Diagnostics), "base64")
}

func TestNormalizeAcceptsTextAttachment(t *testing.T) {
	req := validRequest()
	input, err := Normalize(req, "request-report", &AttachmentUpload{
		Filename:    "console.log",
		ContentType: "text/plain",
		Data:        []byte("loading never finished"),
	})
	require.NoError(t, err)
	require.Equal(t, "text/plain", input.AttachmentMIME)
	require.Equal(t, "console.log", input.AttachmentName)
	require.Equal(t, int32(22), input.AttachmentSize)
}

func TestNormalizeRejectsTooManyBreadcrumbs(t *testing.T) {
	req := validRequest()
	for len(req.Breadcrumbs) <= MaxBreadcrumbs {
		req.Breadcrumbs = append(req.Breadcrumbs, Breadcrumb{Time: "00:00:00", Type: "click", Target: "button"})
	}
	_, err := Normalize(req, "request-report", nil)
	require.ErrorIs(t, err, ErrValidation)
}
