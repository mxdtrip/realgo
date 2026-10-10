package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProblemReports exposes submitted bug reports without rendering attachment bytes.
func ProblemReports(ctx *context.Context) table.Table {
	cfg := table.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey("id", db.UUID).
		SetCanAdd(false).
		SetEditable(false).
		SetDeletable(false)

	reports := table.NewDefaultTable(ctx, cfg)
	info := reports.GetInfo()
	info.AddField("ID", "id", db.UUID).FieldSortable()
	info.AddField("User", "email", db.Text).FieldJoin(types.Join{
		Field:     "user_id",
		JoinField: "id",
		Table:     "users",
	})
	info.AddField("Description", "description", db.Text)
	info.AddField("Fingerprint", "fingerprint", db.Char)
	info.AddField("Release", "release_version", db.Varchar)
	info.AddField("Commit", "commit_sha", db.Varchar)
	info.AddField("Request ID", "source_request_id", db.Varchar)
	info.AddField("Attachment", "attachment_filename", db.Varchar).
		FieldDisplay(func(value types.FieldModel) interface{} {
			return attachmentDownloadLink(value.ID, value.Value)
		})
	info.AddField("MIME", "attachment_mime", db.Varchar)
	info.AddField("Size", "attachment_size", db.Int4).FieldDisplay(func(value types.FieldModel) interface{} {
		return formatAttachmentSize(value.Value)
	})
	info.AddField("Diagnostics", "diagnostics", db.JSON).FieldHideForList().
		FieldDisplay(func(value types.FieldModel) interface{} {
			return formatDiagnostics(value.Value)
		})
	info.AddField("Attachment expires", "attachment_expires_at", db.Timestamptz).FieldSortable()
	info.AddField("Created", "created_at", db.Timestamptz).FieldSortable()
	info.AddField("Expires", "expires_at", db.Timestamptz).FieldSortable()
	addILikeFilters(info,
		ilikeFilter{"User", "users", "email"},
		ilikeFilter{"Fingerprint", "problem_reports", "fingerprint"},
		ilikeFilter{"Release", "problem_reports", "release_version"},
		ilikeFilter{"Request ID", "problem_reports", "source_request_id"},
		ilikeFilter{"Attachment", "problem_reports", "attachment_filename"},
		ilikeFilter{"MIME", "problem_reports", "attachment_mime"},
	)
	info.SetTable("problem_reports").
		SetTitle("Problem reports").
		SetDescription("User-submitted bug reports").
		HideNewButton().
		HideEditButton().
		HideDeleteButton()

	return reports
}

// DownloadProblemReportAttachment returns an auth-protected GoAdmin handler for
// downloading stored report attachments without rendering their bytes in tables.
func DownloadProblemReportAttachment(pool *pgxpool.Pool) context.Handler {
	return func(ctx *context.Context) {
		id := strings.TrimSpace(ctx.Request.URL.Query().Get("id"))
		if id == "" {
			ctx.Data(http.StatusNotFound, "text/plain; charset=utf-8", []byte("attachment not found"))
			return
		}

		var filename string
		var data []byte
		err := pool.QueryRow(ctx.Request.Context(), `
			SELECT attachment_filename, attachment
			FROM problem_reports
			WHERE id = $1
			  AND attachment IS NOT NULL
			  AND attachment_expires_at > CURRENT_TIMESTAMP
		`, id).Scan(&filename, &data)
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.Data(http.StatusNotFound, "text/plain; charset=utf-8", []byte("attachment not found"))
			return
		}
		if err != nil {
			ctx.Data(http.StatusInternalServerError, "text/plain; charset=utf-8", []byte("could not load attachment"))
			return
		}

		filename = safeAttachmentFilename(filename)
		ctx.DataWithHeaders(http.StatusOK, map[string]string{
			"Cache-Control":          "no-store",
			"Content-Disposition":    mime.FormatMediaType("attachment", map[string]string{"filename": filename}),
			"Content-Length":         strconv.Itoa(len(data)),
			"Content-Type":           "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		}, data)
	}
}

func attachmentDownloadLink(reportID, filename string) template.HTML {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return ""
	}
	href := "/admin/api/problem_reports/" + url.PathEscape(reportID) + "/attachment"
	download := template.HTMLEscapeString(safeAttachmentFilename(filename))
	return template.HTML(fmt.Sprintf(
		`%s <a class="btn btn-xs btn-primary" href="%s" download="%s" target="_blank" rel="noopener" data-pjax="0">Download</a>`,
		template.HTMLEscapeString(filename),
		template.HTMLEscapeString(href),
		download,
	))
}

func safeAttachmentFilename(filename string) string {
	filename = strings.ReplaceAll(filename, "\\", "/")
	filename = filepath.Base(strings.TrimSpace(filename))
	if filename == "" || filename == "." || filename == string(filepath.Separator) {
		return "problem-report-attachment"
	}
	return filename
}

func formatAttachmentSize(raw string) string {
	if raw == "" {
		return ""
	}
	size, err := strconv.Atoi(raw)
	if err != nil {
		return raw
	}
	if size < 1024 {
		return fmt.Sprintf("%d B", size)
	}
	if size < 1024*1024 {
		return fmt.Sprintf("%.1f KB", float64(size)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(size)/(1024*1024))
}

type diagnosticsView struct {
	ReportedAt  string                 `json:"reportedAt"`
	Page        diagnosticsPage        `json:"page"`
	Browser     diagnosticsClient      `json:"browser"`
	OS          diagnosticsClient      `json:"os"`
	Network     *diagnosticsNetwork    `json:"network"`
	Breadcrumbs []map[string]any       `json:"breadcrumbs"`
	Errors      []diagnosticsError     `json:"errors"`
	Release     diagnosticsRelease     `json:"release"`
	Raw         map[string]interface{} `json:"-"`
}

type diagnosticsPage struct {
	Route    string `json:"route"`
	Viewport struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"viewport"`
	Locale   string `json:"locale"`
	Timezone string `json:"timezone"`
	Online   *bool  `json:"online"`
}

type diagnosticsClient struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Engine  string `json:"engine"`
}

type diagnosticsNetwork struct {
	Method         string `json:"method"`
	Endpoint       string `json:"endpoint"`
	Status         any    `json:"status"`
	StatusText     string `json:"statusText"`
	ResponseTimeMS int    `json:"responseTimeMs"`
	StartedAt      string `json:"startedAt"`
	RequestID      string `json:"requestId"`
}

type diagnosticsError struct {
	Time    string `json:"time"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Stack   string `json:"stack"`
	Source  string `json:"source"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
}

type diagnosticsRelease struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

type diagnosticRow struct {
	Label string
	Value string
}

func formatDiagnostics(raw string) template.HTML {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	var view diagnosticsView
	if err := json.Unmarshal([]byte(raw), &view); err != nil {
		return template.HTML(`<pre style="white-space:pre-wrap;margin:0;">` + htmlEscape(raw) + `</pre>`)
	}

	var generic map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &generic); err == nil {
		view.Raw = generic
	}

	rows := diagnosticRows(view)
	var html strings.Builder
	html.WriteString(`<div style="max-width:920px;font-size:13px;line-height:1.45;">`)
	if len(rows) > 0 {
		html.WriteString(`<dl style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:6px 14px;margin:0 0 12px;">`)
		for _, row := range rows {
			html.WriteString(`<dt style="font-weight:600;color:#555;">` + htmlEscape(row.Label) + `</dt>`)
			html.WriteString(`<dd style="margin:0;word-break:break-word;">` + htmlEscape(row.Value) + `</dd>`)
		}
		html.WriteString(`</dl>`)
	}
	writeDiagnosticErrors(&html, view.Errors)
	writeJSONDetails(&html, "Breadcrumbs", view.Breadcrumbs, len(view.Errors) == 0)
	if view.Raw != nil {
		writeJSONDetails(&html, "Raw JSON", view.Raw, false)
	}
	html.WriteString(`</div>`)
	return template.HTML(html.String())
}

func diagnosticRows(view diagnosticsView) []diagnosticRow {
	rows := make([]diagnosticRow, 0, 8)
	add := func(label, value string) {
		value = strings.TrimSpace(value)
		if value != "" {
			rows = append(rows, diagnosticRow{Label: label, Value: value})
		}
	}

	add("Reported at", view.ReportedAt)
	add("Route", view.Page.Route)
	if view.Page.Viewport.Width > 0 && view.Page.Viewport.Height > 0 {
		add("Viewport", fmt.Sprintf("%dx%d", view.Page.Viewport.Width, view.Page.Viewport.Height))
	}
	add("Locale", joinNonEmpty(view.Page.Locale, view.Page.Timezone))
	if view.Page.Online != nil {
		if *view.Page.Online {
			add("Connectivity", "online")
		} else {
			add("Connectivity", "offline")
		}
	}
	add("Browser", joinNonEmpty(view.Browser.Name, view.Browser.Version, parenthesize(view.Browser.Engine)))
	add("OS", joinNonEmpty(view.OS.Name, view.OS.Version))
	if view.Network != nil {
		add("Network", formatDiagnosticNetwork(*view.Network))
	}
	add("Release", joinNonEmpty(view.Release.Version, view.Release.Commit))
	return rows
}

func formatDiagnosticNetwork(network diagnosticsNetwork) string {
	parts := []string{}
	if network.Method != "" || network.Endpoint != "" {
		parts = append(parts, joinNonEmpty(network.Method, network.Endpoint))
	}
	status := scalarString(network.Status)
	if status != "" {
		parts = append(parts, "status "+status)
	}
	if network.StatusText != "" {
		parts = append(parts, network.StatusText)
	}
	if network.ResponseTimeMS > 0 {
		parts = append(parts, fmt.Sprintf("%d ms", network.ResponseTimeMS))
	}
	if network.RequestID != "" {
		parts = append(parts, "request "+network.RequestID)
	}
	return strings.Join(parts, " | ")
}

func writeDiagnosticErrors(html *strings.Builder, errors []diagnosticsError) {
	if len(errors) == 0 {
		return
	}
	html.WriteString(`<details open style="margin:10px 0;"><summary style="cursor:pointer;font-weight:600;">Errors</summary>`)
	for _, err := range errors {
		html.WriteString(`<div style="margin:8px 0;padding:8px;border:1px solid #ddd;border-radius:4px;">`)
		html.WriteString(`<div style="font-weight:600;word-break:break-word;">` + htmlEscape(joinNonEmpty(err.Type, err.Message)) + `</div>`)
		meta := joinNonEmpty(err.Time, sourcePosition(err))
		if meta != "" {
			html.WriteString(`<div style="margin-top:3px;color:#666;word-break:break-word;">` + htmlEscape(meta) + `</div>`)
		}
		if err.Stack != "" {
			html.WriteString(`<pre style="white-space:pre-wrap;margin:8px 0 0;max-height:220px;overflow:auto;background:#f7f7f7;padding:8px;">` + htmlEscape(err.Stack) + `</pre>`)
		}
		html.WriteString(`</div>`)
	}
	html.WriteString(`</details>`)
}

func writeJSONDetails(html *strings.Builder, label string, value any, open bool) {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil || len(data) == 0 || string(data) == "null" {
		return
	}
	openAttr := ""
	if open {
		openAttr = " open"
	}
	html.WriteString(`<details` + openAttr + ` style="margin:10px 0;"><summary style="cursor:pointer;font-weight:600;">` + htmlEscape(label) + `</summary>`)
	html.WriteString(`<pre style="white-space:pre-wrap;margin:8px 0 0;max-height:280px;overflow:auto;background:#f7f7f7;padding:8px;">` + htmlEscape(string(data)) + `</pre>`)
	html.WriteString(`</details>`)
}

func sourcePosition(err diagnosticsError) string {
	if err.Source == "" {
		return ""
	}
	position := err.Source
	if err.Line > 0 {
		position += ":" + strconv.Itoa(err.Line)
		if err.Column > 0 {
			position += ":" + strconv.Itoa(err.Column)
		}
	}
	return position
}

func joinNonEmpty(values ...string) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			parts = append(parts, value)
		}
	}
	return strings.Join(parts, " ")
}

func parenthesize(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return "(" + value + ")"
}

func scalarString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	default:
		return fmt.Sprint(v)
	}
}

func htmlEscape(value string) string {
	return template.HTMLEscapeString(value)
}
