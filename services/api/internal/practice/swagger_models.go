package practice

// PracticeAdded documents a map-shaped HTTP payload.
//
// swagger:model PracticeAdded
type PracticeAdded struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Active bool `json:"active"`
}

// PracticeList documents a map-shaped HTTP payload.
//
// swagger:model PracticeList
type PracticeList struct {
	// Required: true
	Subpatterns []Subpattern `json:"subpatterns"`
}
