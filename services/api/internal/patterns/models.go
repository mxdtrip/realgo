package patterns

import "errors"

var ErrPatternNotFound = errors.New("pattern not found")

// Pattern documents the PatternsPattern JSON shape.
//
// swagger:model PatternsPattern
type Pattern struct {
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Description string `json:"description"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ParentID *int64 `json:"parent_id"`
	// Required: true
	ProblemCount int `json:"problem_count"`
	// Required: true
	SolvedCount int `json:"solved_count"`
	// Required: true
	DueCount int `json:"due_count"`
}

// WeakPattern documents the PatternsWeakPattern JSON shape.
//
// swagger:model PatternsWeakPattern
type WeakPattern struct {
	// Required: true
	PatternCode string `json:"pattern_code"`
	// Required: true
	Pattern string `json:"pattern"`
	// Required: true
	HardCount int `json:"hard_count"`
	// Required: true
	ReviewCount int `json:"review_count"`
	// Required: true
	LowConfidence bool `json:"low_confidence"`
}

// PatternDetail documents the PatternsPatternDetail JSON shape.
//
// swagger:model PatternsPatternDetail
type PatternDetail struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Description string `json:"description"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Techniques []string `json:"techniques"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RecognitionSymptoms []string `json:"recognitionSymptoms"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Checklist []string `json:"checklist"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ExampleProblems []ExampleProblem `json:"exampleProblems"`
}

// ExampleProblem documents the PatternsExampleProblem JSON shape.
//
// swagger:model PatternsExampleProblem
type ExampleProblem struct {
	// Required: true
	Title string `json:"title"`
	// Required: true
	Difficulty string `json:"difficulty"`
	// Required: true
	URL string `json:"url"`
}
