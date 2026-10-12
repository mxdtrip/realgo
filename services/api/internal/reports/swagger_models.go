package reports

// SwaggerBrowserClient documents browser diagnostics, where engine is required.
// swagger:model ReportsBrowserClient
// swagger:additionalProperties false
type SwaggerBrowserClient struct {
	Client
	// Required: true
	// Min Length: 1
	// Max Length: 80
	Engine string `json:"engine"`
}
