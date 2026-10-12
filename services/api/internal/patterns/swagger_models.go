package patterns

// AtlasCompanies documents a map-shaped HTTP payload.
//
// swagger:model AtlasCompanies
type AtlasCompanies struct {
	// Required: true
	Companies []AtlasCompany `json:"companies"`
}

// PatternsList documents a map-shaped HTTP payload.
//
// swagger:model PatternsList
type PatternsList struct {
	// Required: true
	Patterns []Pattern `json:"patterns"`
}
