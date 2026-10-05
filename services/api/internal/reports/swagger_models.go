package reports

// SwaggerBrowserClient documents browser diagnostics, where engine is required.
// swagger:model ReportsBrowserClient
// swagger:additionalProperties false
type SwaggerBrowserClient struct {
	// Required: true
	// Min Length: 1
	// Max Length: 80
	Name string `json:"name"`
	// Required: false
	// Max Length: 80
	Version string `json:"version"`
	// Required: true
	// Min Length: 1
	// Max Length: 80
	Engine string `json:"engine"`
}
