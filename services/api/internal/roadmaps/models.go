package roadmaps

// Item documents the RoadmapsItem JSON shape.
//
// swagger:model RoadmapsItem
type Item struct {
	// Position is the position JSON field.
	//
	// Required: true
	Position int `json:"position"`
	// PatternCode is the pattern_code JSON field.
	//
	// Required: true
	PatternCode string `json:"pattern_code"`
	// Pattern is the pattern JSON field.
	//
	// Required: true
	Pattern string `json:"pattern"`
	// ProblemID is the problem_id JSON field.
	//
	// Required: true
	ProblemID int64 `json:"problem_id"`
	// ExternalID is the external_id JSON field.
	//
	// Required: true
	ExternalID string `json:"external_id"`
	// Slug is the slug JSON field.
	//
	// Required: true
	Slug string `json:"slug"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// URL is the url JSON field.
	//
	// Required: true
	URL string `json:"url"`
	// Difficulty is the difficulty JSON field.
	//
	// Required: true
	Difficulty string `json:"difficulty"`
}

// Response documents the RoadmapsResponse JSON shape.
//
// swagger:model RoadmapsResponse
type Response struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Items is the items JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Items []Item `json:"items"`
}
