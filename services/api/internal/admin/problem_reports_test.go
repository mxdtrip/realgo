package admin

import (
	"strings"
	"testing"
)

func TestProblemReportsAdminIntegration(t *testing.T) {
	if Generators["problem_reports"] == nil {
		t.Fatal("problem_reports generator is not registered")
	}

	panel, err := Dashboard(nil)
	if err != nil {
		t.Fatalf("Dashboard() error = %v", err)
	}
	if !strings.Contains(string(panel.Content), "/admin/info/problem_reports") {
		t.Fatal("dashboard does not link to problem reports")
	}
}

func TestAttachmentDownloadLink(t *testing.T) {
	got := string(attachmentDownloadLink("4fd0b810-7da1-48d2-bf9c-717e4d2a19df", `console <log>.txt`))
	if !strings.Contains(got, "/admin/api/problem_reports/4fd0b810-7da1-48d2-bf9c-717e4d2a19df/attachment") {
		t.Fatalf("download link href missing: %s", got)
	}
	if !strings.Contains(got, "Download") {
		t.Fatalf("download link label missing: %s", got)
	}
	if !strings.Contains(got, `download="console &lt;log&gt;.txt"`) {
		t.Fatalf("download attribute missing: %s", got)
	}
	if !strings.Contains(got, `target="_blank"`) || !strings.Contains(got, `data-pjax="0"`) {
		t.Fatalf("download link does not bypass admin pjax navigation: %s", got)
	}
	if strings.Contains(got, `console <log>.txt`) || !strings.Contains(got, "console &lt;log&gt;.txt") {
		t.Fatalf("download link filename is not escaped: %s", got)
	}
}

func TestSafeAttachmentFilename(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "plain", raw: "console.log", want: "console.log"},
		{name: "path", raw: "../../secret.txt", want: "secret.txt"},
		{name: "windows path", raw: `C:\Users\user\video.mp4`, want: "video.mp4"},
		{name: "empty", raw: " ", want: "problem-report-attachment"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := safeAttachmentFilename(tt.raw); got != tt.want {
				t.Fatalf("safeAttachmentFilename(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestFormatDiagnostics(t *testing.T) {
	raw := `{
		"reportedAt":"2026-08-24T10:00:00Z",
		"page":{"route":"/cabinet?tab","viewport":{"width":1440,"height":900},"locale":"ru-RU","timezone":"Europe/Istanbul","online":true},
		"browser":{"name":"Chrome","version":"125","engine":"Blink"},
		"os":{"name":"macOS","version":"15"},
		"network":{"method":"POST","endpoint":"/api/me/problem-reports","status":500,"statusText":"Internal Server Error","responseTimeMs":123,"requestId":"req-1"},
		"errors":[{"time":"2026-08-24T10:00:01Z","type":"error","message":"bad <script>","stack":"at foo (/app/page.tsx:1:1)"}],
		"breadcrumbs":[{"time":"12:00:00","type":"click","target":"button.primary"}],
		"release":{"version":"development","commit":"abc123"}
	}`

	got := string(formatDiagnostics(raw))
	for _, want := range []string{
		"Route",
		"/cabinet?tab",
		"1440x900",
		"Chrome 125 (Blink)",
		"POST /api/me/problem-reports | status 500 | Internal Server Error | 123 ms | request req-1",
		"Errors",
		"bad &lt;script&gt;",
		"Breadcrumbs",
		"Raw JSON",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("formatDiagnostics() missing %q in %s", want, got)
		}
	}
	if strings.Contains(got, "bad <script>") {
		t.Fatalf("formatDiagnostics() did not escape html: %s", got)
	}
}

func TestFormatAttachmentSize(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty", want: ""},
		{name: "bytes", raw: "512", want: "512 B"},
		{name: "kilobytes", raw: "1536", want: "1.5 KB"},
		{name: "megabytes", raw: "15728640", want: "15.0 MB"},
		{name: "non numeric", raw: "unknown", want: "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := formatAttachmentSize(tt.raw); got != tt.want {
				t.Fatalf("formatAttachmentSize(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}
