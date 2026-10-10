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
	// Required: true
	TaxonomyVersion string `json:"taxonomy_version"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tools []AtlasTool `json:"tools"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Families []AtlasFamily `json:"families"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Subpatterns []AtlasSubpattern `json:"subpatterns"`
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
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Position int `json:"position"`
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
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Description string `json:"description"`
	// Required: true
	Position int `json:"position"`
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
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Position int `json:"position"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	FamilyCodes []string `json:"family_codes"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ToolCodes []string `json:"tool_codes"`
	// Required: true
	Stats SubpatternStats `json:"stats"`
	// Required: true
	Mastery Mastery `json:"mastery"`
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
	// Required: true
	ProblemCount int `json:"problem_count"`
	// Required: true
	SolvedCount int `json:"solved_count"`
	// Required: true
	InProgressCount int `json:"in_progress_count"`
	// Required: true
	DueCount int `json:"due_count"`
	// Required: true
	CardCount int `json:"card_count"`
	// Required: true
	AttemptCount int `json:"attempt_count"`
	// Required: true
	HardCount int `json:"hard_count"`
	// DifficultyCounts is the catalog-wide easy/medium/hard/unknown split of
	// the subpattern's practice set (same for every user).
	// Required: false
	DifficultyCounts map[string]int `json:"difficulty_counts,omitempty"`
	// swagger:name next_review_at
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
	// swagger:name last_solved_at
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
	// Required: true
	// Enum: ["not_started", "learning", "weak", "unstable", "strong", "mastered"]
	Status string `json:"status"`
	// Required: true
	Percent int `json:"percent"`
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
	// Required: true
	Practice int `json:"practice"`
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
	// Required: true
	RelevantSubpatterns int `json:"relevant_subpatterns"`
	// Required: true
	Strong int `json:"strong"`
	// Required: true
	Unstable int `json:"unstable"`
	// Required: true
	Weak int `json:"weak"`
	// Required: true
	NotStarted int `json:"not_started"`
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
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Relevance string `json:"relevance"`
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
	// Required: true
	SubpatternCode string `json:"subpattern_code"`
	// Required: true
	SubpatternName string `json:"subpattern_name"`
	// Required: true
	EvidenceCount int `json:"evidence_count"`
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
	// Required: true
	SourceType string `json:"source_type"`
}

// AtlasCompany documents the PatternsAtlasCompany JSON shape.
//
// swagger:model PatternsAtlasCompany
type AtlasCompany struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	SubpatternCount int `json:"subpattern_count"`
	// Required: true
	DemoOnly bool `json:"demo_only"`
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
}

// NodeRef is a lightweight reference to a related taxonomy node.
// NodeRef documents the PatternsNodeRef JSON shape.
//
// swagger:model PatternsNodeRef
type NodeRef struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
}

// ContrastPair is one "don't confuse with" entry of a learning material.
// ContrastPair documents the PatternsContrastPair JSON shape.
//
// swagger:model PatternsContrastPair
type ContrastPair struct {
	// Required: true
	Title string `json:"title"`
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
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	Type string `json:"type"`
	// Required: true
	Question string `json:"question"`
	// swagger:name next_review_at
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
	// Required: false
	LastRating string `json:"last_rating,omitempty"`
}

// PracticeProblem documents the PatternsPracticeProblem JSON shape.
//
// swagger:model PatternsPracticeProblem
type PracticeProblem struct {
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	URL string `json:"url"`
	// Required: true
	Difficulty string `json:"difficulty"`
	// Required: false
	Tier string `json:"tier,omitempty"`
	// Required: true
	Status string `json:"status"`
	// Required: false
	Platform string `json:"platform,omitempty"`
	// Required: false
	Rating string `json:"rating,omitempty"`
	// swagger:name solved_at
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	SolvedAt *time.Time `json:"solved_at,omitempty"`
	// swagger:name next_review_at
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
	// Required: true
	EvidenceCount int `json:"evidence_count"`
	// Required: false
	LastSeenAt string `json:"last_seen_at,omitempty"`
	// Required: true
	SourceType string `json:"source_type"`
}

// CompanyPracticeGroup documents the PatternsCompanyPracticeGroup JSON shape.
//
// swagger:model PatternsCompanyPracticeGroup
type CompanyPracticeGroup struct {
	// Required: true
	Company NodeRef `json:"company"`
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
	// Required: true
	Code string `json:"code"`
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
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Kind string `json:"kind"`
	// Required: true
	Description string `json:"description"`
	// Required: false
	TaxonomyVersion string `json:"taxonomy_version,omitempty"`

	// Family-level methodology (pre-atlas content, still shown for families).
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
	RecognitionSymptoms []string `json:"recognition_symptoms"`
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
	ExampleProblems []ExampleProblem `json:"example_problems"`

	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Families []NodeRef `json:"families,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tools []NodeRef `json:"tools,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Subpatterns []NodeRef `json:"subpatterns,omitempty"`

	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Material *LearningMaterial `json:"material,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Stats *SubpatternStats `json:"stats,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Mastery *Mastery `json:"mastery,omitempty"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Cards []CardSummary `json:"cards"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Practice []PracticeProblem `json:"practice"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	CompanyPractice []CompanyPracticeGroup `json:"company_practice"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RelevantCompanies []RelevantCompany `json:"relevant_companies"`
}
