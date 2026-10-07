package roadmaps

// Item documents the RoadmapsItem JSON shape.
//
// swagger:model RoadmapsItem
type Item struct {
	// Required: true
	Position int `json:"position"`
	// Required: true
	PatternCode string `json:"pattern_code"`
	// Required: true
	Pattern string `json:"pattern"`
	// Required: true
	ProblemID int64 `json:"problem_id"`
	// Required: true
	ExternalID string `json:"external_id"`
	// Required: true
	Slug string `json:"slug"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	URL string `json:"url"`
	// Required: true
	Difficulty string `json:"difficulty"`
}

// Response documents the RoadmapsResponse JSON shape.
//
// swagger:model RoadmapsResponse
type Response struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Items []Item `json:"items"`
}
