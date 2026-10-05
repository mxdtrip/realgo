package patterns

import "errors"

var ErrPatternNotFound = errors.New("pattern not found")

// Pattern documents the PatternsPattern JSON shape.
//
// swagger:model PatternsPattern
type Pattern struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Description is the description JSON field.
	//
	// Required: true
	Description string `json:"description"`
	// ParentID is the parent_id JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ParentID *int64 `json:"parent_id"`
	// ProblemCount is the problem_count JSON field.
	//
	// Required: true
	ProblemCount int `json:"problem_count"`
	// SolvedCount is the solved_count JSON field.
	//
	// Required: true
	SolvedCount int `json:"solved_count"`
	// DueCount is the due_count JSON field.
	//
	// Required: true
	DueCount int `json:"due_count"`
}

// WeakPattern documents the PatternsWeakPattern JSON shape.
//
// swagger:model PatternsWeakPattern
type WeakPattern struct {
	// PatternCode is the pattern_code JSON field.
	//
	// Required: true
	PatternCode string `json:"pattern_code"`
	// Pattern is the pattern JSON field.
	//
	// Required: true
	Pattern string `json:"pattern"`
	// HardCount is the hard_count JSON field.
	//
	// Required: true
	HardCount int `json:"hard_count"`
	// ReviewCount is the review_count JSON field.
	//
	// Required: true
	ReviewCount int `json:"review_count"`
	// LowConfidence is the low_confidence JSON field.
	//
	// Required: true
	LowConfidence bool `json:"low_confidence"`
}

// PatternDetail documents the PatternsPatternDetail JSON shape.
//
// swagger:model PatternsPatternDetail
type PatternDetail struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Description is the description JSON field.
	//
	// Required: true
	Description string `json:"description"`
	// Techniques is the techniques JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Techniques []string `json:"techniques"`
	// RecognitionSymptoms is the recognitionSymptoms JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RecognitionSymptoms []string `json:"recognitionSymptoms"`
	// Checklist is the checklist JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Checklist []string `json:"checklist"`
	// ExampleProblems is the exampleProblems JSON field.
	//
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
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Difficulty is the difficulty JSON field.
	//
	// Required: true
	Difficulty string `json:"difficulty"`
	// URL is the url JSON field.
	//
	// Required: true
	URL string `json:"url"`
}
