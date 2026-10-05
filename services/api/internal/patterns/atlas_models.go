package patterns

import "time"

// TaxonomyVersion is the currently served taxonomy release. Bumping it (and
// shipping the matching nodes/edges, migration 000015) is how a new taxonomy
// rolls out without rewriting the atlas API.
const TaxonomyVersion = "realgo-v2"

// Mastery statuses, ordered from "never touched" to "fully retained".
const (
	MasteryNotStarted = "not_started"
	MasteryLearning   = "learning"
	MasteryWeak       = "weak"
	MasteryUnstable   = "unstable"
	MasteryStrong     = "strong"
	MasteryMastered   = "mastered"
)

// AtlasResponse is the full Pattern Atlas payload: taxonomy nodes, edges and
// per-user state in one round trip (the taxonomy is small by design).
// AtlasResponse documents the PatternsAtlasResponse JSON shape.
//
// swagger:model PatternsAtlasResponse
type AtlasResponse struct {
	// TaxonomyVersion is the taxonomy_version JSON field.
	//
	// Required: true
	TaxonomyVersion string `json:"taxonomy_version"`
	// Tools is the tools JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tools []AtlasTool `json:"tools"`
	// Families is the families JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Families []AtlasFamily `json:"families"`
	// Subpatterns is the subpatterns JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Subpatterns []AtlasSubpattern `json:"subpatterns"`
	// Company is the company JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Company *AtlasCompanyOverlay `json:"company,omitempty"`
}

// AtlasTool documents the PatternsAtlasTool JSON shape.
//
// swagger:model PatternsAtlasTool
type AtlasTool struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Position is the position JSON field.
	//
	// Required: true
	Position int `json:"position"`
	// SubpatternCodes is the subpattern_codes JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	SubpatternCodes []string `json:"subpattern_codes"`
}

// AtlasFamily documents the PatternsAtlasFamily JSON shape.
//
// swagger:model PatternsAtlasFamily
type AtlasFamily struct {
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
	// Position is the position JSON field.
	//
	// Required: true
	Position int `json:"position"`
	// SubpatternCodes is the subpattern_codes JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	SubpatternCodes []string `json:"subpattern_codes"`
}

// AtlasSubpattern documents the PatternsAtlasSubpattern JSON shape.
//
// swagger:model PatternsAtlasSubpattern
type AtlasSubpattern struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Position is the position JSON field.
	//
	// Required: true
	Position int `json:"position"`
	// FamilyCodes is the family_codes JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	FamilyCodes []string `json:"family_codes"`
	// ToolCodes is the tool_codes JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ToolCodes []string `json:"tool_codes"`
	// Stats is the stats JSON field.
	//
	// Required: true
	Stats SubpatternStats `json:"stats"`
	// Mastery is the mastery JSON field.
	//
	// Required: true
	Mastery Mastery `json:"mastery"`
	// Relevance is the relevance JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Relevance *CompanyRelevance `json:"relevance,omitempty"`
}

// SubpatternStats are the raw per-user aggregates a subpattern's mastery is
// derived from. Kept separate from Mastery so the calculation can evolve
// (recognition/transfer/retention components) without an API break.
// SubpatternStats documents the PatternsSubpatternStats JSON shape.
//
// swagger:model PatternsSubpatternStats
type SubpatternStats struct {
	// ProblemCount is the problem_count JSON field.
	//
	// Required: true
	ProblemCount int `json:"problem_count"`
	// SolvedCount is the solved_count JSON field.
	//
	// Required: true
	SolvedCount int `json:"solved_count"`
	// InProgressCount is the in_progress_count JSON field.
	//
	// Required: true
	InProgressCount int `json:"in_progress_count"`
	// DueCount is the due_count JSON field.
	//
	// Required: true
	DueCount int `json:"due_count"`
	// CardCount is the card_count JSON field.
	//
	// Required: true
	CardCount int `json:"card_count"`
	// AttemptCount is the attempt_count JSON field.
	//
	// Required: true
	AttemptCount int `json:"attempt_count"`
	// HardCount is the hard_count JSON field.
	//
	// Required: true
	HardCount int `json:"hard_count"`
	// DifficultyCounts is the catalog-wide easy/medium/hard/unknown split of
	// the subpattern's practice set (same for every user).
	// DifficultyCounts is the difficulty_counts JSON field.
	//
	// Required: false
	DifficultyCounts map[string]int `json:"difficulty_counts,omitempty"`
	// swagger:name next_review_at
	// NextReviewAt is the next_review_at JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
	// swagger:name last_solved_at
	// LastSolvedAt is the last_solved_at JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	LastSolvedAt *time.Time `json:"last_solved_at,omitempty"`
}

// Mastery documents the PatternsMastery JSON shape.
//
// swagger:model PatternsMastery
type Mastery struct {
	// Status is the status JSON field.
	//
	// Required: true
	// Enum: ["not_started", "learning", "weak", "unstable", "strong", "mastered"]
	Status string `json:"status"`
	// Percent is the percent JSON field.
	//
	// Required: true
	Percent int `json:"percent"`
	// Components is the components JSON field.
	//
	// Required: true
	Components MasteryComponents `json:"components"`
}

// MasteryComponents keeps the aggregate percent decomposable. More components
// (recognition, discrimination, transfer) can be added without breaking the
// payload shape.
// MasteryComponents documents the PatternsMasteryComponents JSON shape.
//
// swagger:model PatternsMasteryComponents
type MasteryComponents struct {
	// Practice is the practice JSON field.
	//
	// Required: true
	Practice int `json:"practice"`
	// Retention is the retention JSON field.
	//
	// Required: true
	Retention int `json:"retention"`
}

// CompanyRelevance mirrors one subpattern_companies evidence record. It never
// invents data: rows exist only when a dataset provided them, and SourceType
// tells the UI whether it is looking at demo fixtures.
//
// swagger:model PatternsCompanyRelevance
type CompanyRelevance struct {
	// Required: true
	Relevance string `json:"relevance"`
	// Required: true
	Confidence string `json:"confidence"`
	// Required: true
	EvidenceCount int `json:"evidence_count"`
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
	// Required: true
	SourceType string `json:"source_type"`
}

// swagger:model PatternsAtlasCompanyOverlay
type AtlasCompanyOverlay struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	DemoOnly bool `json:"demo_only"`
	// Required: true
	Coverage AtlasCoverage `json:"coverage"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RelevantProblems []AtlasRelevantProblem `json:"relevant_problems,omitempty"`
}

// AtlasCoverage is the readiness summary for a selected company, bucketed by
// mastery status over the subpatterns with actual relevance evidence.
// AtlasCoverage documents the PatternsAtlasCoverage JSON shape.
//
// swagger:model PatternsAtlasCoverage
type AtlasCoverage struct {
	// RelevantSubpatterns is the relevant_subpatterns JSON field.
	//
	// Required: true
	RelevantSubpatterns int `json:"relevant_subpatterns"`
	// Strong is the strong JSON field.
	//
	// Required: true
	Strong int `json:"strong"`
	// Unstable is the unstable JSON field.
	//
	// Required: true
	Unstable int `json:"unstable"`
	// Weak is the weak JSON field.
	//
	// Required: true
	Weak int `json:"weak"`
	// NotStarted is the not_started JSON field.
	//
	// Required: true
	NotStarted int `json:"not_started"`
	// TopGaps is the top_gaps JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	TopGaps []AtlasGap `json:"top_gaps"`
}

// AtlasGap documents the PatternsAtlasGap JSON shape.
//
// swagger:model PatternsAtlasGap
type AtlasGap struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Relevance is the relevance JSON field.
	//
	// Required: true
	Relevance string `json:"relevance"`
	// MasteryPercent is the mastery_percent JSON field.
	//
	// Required: true
	MasteryPercent int `json:"mastery_percent"`
}

// AtlasRelevantProblem is one company-evidence task surfaced in the readiness
// overlay. It pairs PracticeProblem fields with the subpattern the task trains
// and the company evidence weight, so the UI can group tasks next to the
// relevant subpatterns and top gaps.
// AtlasRelevantProblem documents the PatternsAtlasRelevantProblem JSON shape.
//
// swagger:model PatternsAtlasRelevantProblem
type AtlasRelevantProblem struct {
	PracticeProblem
	// SubpatternCode is the subpattern_code JSON field.
	//
	// Required: true
	SubpatternCode string `json:"subpattern_code"`
	// SubpatternName is the subpattern_name JSON field.
	//
	// Required: true
	SubpatternName string `json:"subpattern_name"`
	// EvidenceCount is the evidence_count JSON field.
	//
	// Required: true
	EvidenceCount int `json:"evidence_count"`
	// LastSeenAt is the last_seen_at JSON field.
	//
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
	// SourceType is the source_type JSON field.
	//
	// Required: true
	SourceType string `json:"source_type"`
}

// AtlasCompany documents the PatternsAtlasCompany JSON shape.
//
// swagger:model PatternsAtlasCompany
type AtlasCompany struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// SubpatternCount is the subpattern_count JSON field.
	//
	// Required: true
	SubpatternCount int `json:"subpattern_count"`
	// DemoOnly is the demo_only JSON field.
	//
	// Required: true
	DemoOnly bool `json:"demo_only"`
	// LastSeenAt is the last_seen_at JSON field.
	//
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
}

// NodeRef is a lightweight reference to a related taxonomy node.
// NodeRef documents the PatternsNodeRef JSON shape.
//
// swagger:model PatternsNodeRef
type NodeRef struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
}

// ContrastPair is one "don't confuse with" entry of a learning material.
// ContrastPair documents the PatternsContrastPair JSON shape.
//
// swagger:model PatternsContrastPair
type ContrastPair struct {
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Note is the note JSON field.
	//
	// Required: true
	Note string `json:"note"`
}

// LearningMaterial is the compact methodology unit of a subpattern.
//
// swagger:model PatternsLearningMaterial
type LearningMaterial struct {
	// Required: true
	WhatItIs string `json:"what_it_is"`
	// Required: true
	MentalModel string `json:"mental_model"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RecognitionCues []string `json:"recognition_cues"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	AntiCues []string `json:"anti_cues"`
	// Required: true
	CoreInvariant string `json:"core_invariant"`
	// Required: true
	CanonicalSkeleton string `json:"canonical_skeleton"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	CommonMistakes []string `json:"common_mistakes"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	DontConfuseWith []ContrastPair `json:"dont_confuse_with"`
	// Required: true
	MiniExample string `json:"mini_example"`
}

// CardSummary documents the PatternsCardSummary JSON shape.
//
// swagger:model PatternsCardSummary
type CardSummary struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Type is the type JSON field.
	//
	// Required: true
	Type string `json:"type"`
	// Question is the question JSON field.
	//
	// Required: true
	Question string `json:"question"`
	// swagger:name next_review_at
	// NextReviewAt is the next_review_at JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
	// LastRating is the last_rating JSON field.
	//
	// Required: false
	LastRating string `json:"last_rating,omitempty"`
}

// PracticeProblem documents the PatternsPracticeProblem JSON shape.
//
// swagger:model PatternsPracticeProblem
type PracticeProblem struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
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
	// Tier is the tier JSON field.
	//
	// Required: false
	Tier string `json:"tier,omitempty"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// Platform is the platform JSON field.
	//
	// Required: false
	Platform string `json:"platform,omitempty"`
	// Rating is the rating JSON field.
	//
	// Required: false
	Rating string `json:"rating,omitempty"`
	// swagger:name solved_at
	// SolvedAt is the solved_at JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solved_at,omitempty"`
	// swagger:name next_review_at
	// NextReviewAt is the next_review_at JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
}

// CompanyPracticeProblem documents the PatternsCompanyPracticeProblem JSON shape.
//
// swagger:model PatternsCompanyPracticeProblem
type CompanyPracticeProblem struct {
	PracticeProblem
	// EvidenceCount is the evidence_count JSON field.
	//
	// Required: true
	EvidenceCount int `json:"evidence_count"`
	// LastSeenAt is the last_seen_at JSON field.
	//
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
	// SourceType is the source_type JSON field.
	//
	// Required: true
	SourceType string `json:"source_type"`
}

// CompanyPracticeGroup documents the PatternsCompanyPracticeGroup JSON shape.
//
// swagger:model PatternsCompanyPracticeGroup
type CompanyPracticeGroup struct {
	// Company is the company JSON field.
	//
	// Required: true
	Company NodeRef `json:"company"`
	// Problems is the problems JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Problems []CompanyPracticeProblem `json:"problems"`
}

// RelevantCompany documents the PatternsRelevantCompany JSON shape.
//
// swagger:model PatternsRelevantCompany
type RelevantCompany struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	CompanyRelevance
}

// NodeDetail is the educational view of one taxonomy node. Families carry
// Subpatterns + legacy methodology fields; subpatterns carry the material,
// mastery, cards and practice sections.
// NodeDetail documents the PatternsNodeDetail JSON shape.
//
// swagger:model PatternsNodeDetail
type NodeDetail struct {
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Kind is the kind JSON field.
	//
	// Required: true
	Kind string `json:"kind"`
	// Description is the description JSON field.
	//
	// Required: true
	Description string `json:"description"`
	// TaxonomyVersion is the taxonomy_version JSON field.
	//
	// Required: false
	TaxonomyVersion string `json:"taxonomy_version,omitempty"`

	// Family-level methodology (pre-atlas content, still shown for families).
	// Techniques is the techniques JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Techniques []string `json:"techniques"`
	// RecognitionSymptoms is the recognition_symptoms JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RecognitionSymptoms []string `json:"recognition_symptoms"`
	// Checklist is the checklist JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Checklist []string `json:"checklist"`
	// ExampleProblems is the example_problems JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ExampleProblems []ExampleProblem `json:"example_problems"`

	// Families is the families JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Families []NodeRef `json:"families,omitempty"`
	// Tools is the tools JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tools []NodeRef `json:"tools,omitempty"`
	// Subpatterns is the subpatterns JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Subpatterns []NodeRef `json:"subpatterns,omitempty"`

	// Material is the material JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Material *LearningMaterial `json:"material,omitempty"`
	// Stats is the stats JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Stats *SubpatternStats `json:"stats,omitempty"`
	// Mastery is the mastery JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Mastery *Mastery `json:"mastery,omitempty"`
	// Cards is the cards JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Cards []CardSummary `json:"cards"`
	// Practice is the practice JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Practice []PracticeProblem `json:"practice"`
	// CompanyPractice is the company_practice JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	CompanyPractice []CompanyPracticeGroup `json:"company_practice"`
	// RelevantCompanies is the relevant_companies JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RelevantCompanies []RelevantCompany `json:"relevant_companies"`
}
