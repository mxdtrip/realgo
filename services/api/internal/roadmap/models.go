package roadmap

const (
	PriorityBalanced         = "balanced"
	PriorityEasyFirst        = "easy_first"
	PriorityCompanyFrequency = "company_frequency"
	PriorityKnowledgeGaps    = "knowledge_gaps"

	SourceCompany = "company"
	SourceCore    = "core"

	weeklyCapacityDefault = 3
	algorithmVersion      = 1

	StageTheory   = "theory"
	StageTasks    = "tasks"
	StageCards    = "cards"
	StageComplete = "complete"
)

var allPriorityModes = []string{
	PriorityBalanced,
	PriorityEasyFirst,
	PriorityCompanyFrequency,
	PriorityKnowledgeGaps,
}

// ConfigRequest documents the RoadmapConfigRequest JSON shape.
//
// Example: {"companyCode":"cmp_google","companyName":"Google","interviewDate":"2026-12-01","priorityMode":"balanced","preserveProgress":false}
//
// swagger:model RoadmapConfigRequest
// swagger:additionalProperties false
type ConfigRequest struct {
	// Код компании. После trim — не более 120 байт.
	//
	// Required: false
	CompanyCode string `json:"companyCode"`
	// Название компании. После trim — не более 200 байт.
	//
	// Required: false
	CompanyName string `json:"companyName"`
	// YYYY-MM-DD, пустая строка или null.
	//
	// Required: false
	// Swagger 2.0 cannot validate this scalar union; the handler accepts the listed alternatives.
	// Extensions:
	// ---
	// x-nullable: true
	// x-oneOf:
	// - type: string
	//   format: date
	//   x-nullable: true
	// - type: string
	//   enum:
	//   - ''
	// ---
	InterviewDate *string `json:"interviewDate"`
	// Required: false
	// Enum: ["", "balanced", "easy_first", "company_frequency", "knowledge_gaps"]
	PriorityMode string `json:"priorityMode"`
	// Сохранить завершённые недели и текущую неделю, перестроить будущее.
	//
	// Required: false
	PreserveProgress bool `json:"preserveProgress"`
}

// Response documents the RoadmapResponse JSON shape.
//
// swagger:model RoadmapResponse
type Response struct {
	// Required: false
	PlanKey string `json:"planKey,omitempty"`
	// Required: true
	OverallProgress int `json:"overallProgress"`
	// Required: true
	Target Target `json:"target"`
	// Required: true
	// Enum: ["balanced", "easy_first", "company_frequency", "knowledge_gaps"]
	PriorityMode string `json:"priorityMode"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	AvailableModes []string `json:"availableModes"`
	// Required: true
	AlgorithmVersion int `json:"algorithmVersion"`
	// Required: true
	Source string `json:"source"`
	// Required: true
	HorizonWeeks int `json:"horizonWeeks"`
	// Required: true
	WeeklyCapacity int `json:"weeklyCapacity"`
	// Required: true
	SelectedCount int `json:"selectedCount"`
	// Required: true
	ReserveCount int `json:"reserveCount"`
	// Required: true
	Configured bool `json:"configured"`
	// swagger:name generatedAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	GeneratedAt *string `json:"generatedAt,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	NextAction *NextAction `json:"nextAction,omitempty"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Weeks []Week `json:"weeks"`
}

// Summary documents the RoadmapSummary JSON shape.
//
// swagger:model RoadmapSummary
type Summary struct {
	// Required: true
	PlanKey string `json:"planKey"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Company *Company `json:"company"`
	// swagger:name interviewDate
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date
	InterviewDate *string `json:"interviewDate"`
	// Required: true
	// Enum: ["balanced", "easy_first", "company_frequency", "knowledge_gaps"]
	PriorityMode string `json:"priorityMode"`
	// swagger:name generatedAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	GeneratedAt *string `json:"generatedAt,omitempty"`
	// Required: true
	Active bool `json:"active"`
}

// swagger:model RoadmapNextAction
type NextAction struct {
	// Required: true
	// Enum: ["theory", "tasks", "cards", "complete"]
	Stage string `json:"stage"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	Description string `json:"description"`
	// Required: true
	Href string `json:"href"`
	// Required: true
	PatternCode string `json:"patternCode"`
	// Required: true
	WeekID string `json:"weekId"`
}

// Target documents the RoadmapTarget JSON shape.
//
// swagger:model RoadmapTarget
type Target struct {
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Company *Company `json:"company"`
	// swagger:name interviewDate
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date
	InterviewDate *string `json:"interviewDate"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Topics []string `json:"topics"`
}

// swagger:model RoadmapCompany
type Company struct {
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Code *string `json:"code"`
	// Required: true
	Name string `json:"name"`
}

// Week documents the RoadmapWeek JSON shape.
//
// swagger:model RoadmapWeek
type Week struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Label string `json:"label"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	Progress int `json:"progress"`
	// Required: true
	Focus string `json:"focus"`
	// Required: true
	Status string `json:"status"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Topics []string `json:"topics"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Items []Item `json:"items"`
}

// Item documents the RoadmapItem JSON shape.
//
// swagger:model RoadmapItem
type Item struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	RelevantProblemCount int `json:"relevantProblemCount"`
	// Required: true
	DifficultyCounts map[string]int `json:"difficultyCounts"`
	// Required: true
	MasteryPercent int `json:"masteryPercent"`
	// Required: true
	PlanProgress int `json:"planProgress"`
	// Required: true
	// Enum: ["theory", "tasks", "cards", "complete"]
	Stage string `json:"stage"`
	// Required: true
	Theory TheoryProgress `json:"theory"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tasks []Task `json:"tasks"`
	// Required: true
	CardProgress CardProgress `json:"cardProgress"`
	// Required: true
	Reinforcement Reinforcement `json:"reinforcement"`
}

// TheoryProgress documents the RoadmapTheoryProgress JSON shape.
//
// swagger:model RoadmapTheoryProgress
type TheoryProgress struct {
	// Required: true
	Completed bool `json:"completed"`
	// swagger:name completedAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	CompletedAt *string `json:"completedAt,omitempty"`
}

// Task documents the RoadmapTask JSON shape.
//
// swagger:model RoadmapTask
type Task struct {
	// Required: true
	ID int64 `json:"id"`
	// Required: true
	OriginalID int64 `json:"originalId"`
	// Required: true
	Title string `json:"title"`
	// Required: true
	URL string `json:"url"`
	// Required: true
	Difficulty string `json:"difficulty"`
	// Required: true
	Tier string `json:"tier"`
	// Required: true
	Status string `json:"status"`
	// Required: false
	AccessStatus string `json:"accessStatus,omitempty"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating,omitempty"`
	// swagger:name nextReviewAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
	// Required: true
	ReviewCount int `json:"reviewCount"`
}

// CardProgress documents the RoadmapCardProgress JSON shape.
//
// swagger:model RoadmapCardProgress
type CardProgress struct {
	// Required: true
	Total int `json:"total"`
	// Required: true
	Reviewed int `json:"reviewed"`
	// Required: true
	Due int `json:"due"`
	// Required: true
	Reinforcement int `json:"reinforcement"`
	// swagger:name nextReviewAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
}

// Reinforcement documents the RoadmapReinforcement JSON shape.
//
// swagger:model RoadmapReinforcement
type Reinforcement struct {
	// Required: true
	Count int `json:"count"`
	// Required: true
	Due int `json:"due"`
	// swagger:name nextReviewAt
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
}

// TheoryCompletion documents the RoadmapTheoryCompletion JSON shape.
//
// swagger:model RoadmapTheoryCompletion
type TheoryCompletion struct {
	// Required: true
	Code string `json:"code"`
	// swagger:name completedAt
	// Required: true
	// swagger:strfmt date-time
	CompletedAt string `json:"completedAt"`
}

// TaskAccessRequest documents the RoadmapTaskAccessRequest JSON shape.
//
// Example: {"action":"replace"}
//
// swagger:model RoadmapTaskAccessRequest
// swagger:additionalProperties false
type TaskAccessRequest struct {
	// Required: true
	// Enum: ["replace", "skip"]
	Action string `json:"action"`
}

// TaskAccessResolution documents the RoadmapTaskAccessResolution JSON shape.
//
// swagger:model RoadmapTaskAccessResolution
type TaskAccessResolution struct {
	// Required: true
	Action string `json:"action"`
	// Required: true
	OriginalProblemID int64 `json:"originalProblemId"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ReplacementProblemID *int64 `json:"replacementProblemId,omitempty"`
}

type planItem struct {
	Item
	WeekIndex        int
	Position         int
	Selected         bool
	TaxonomyPosition int
	EvidenceCount    int
	Confidence       string
	DifficultyScore  float64
	Score            float64
}
