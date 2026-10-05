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
	// PriorityMode is the priorityMode JSON field.
	//
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
	// PlanKey is the planKey JSON field.
	//
	// Required: false
	PlanKey string `json:"planKey,omitempty"`
	// OverallProgress is the overallProgress JSON field.
	//
	// Required: true
	OverallProgress int `json:"overallProgress"`
	// Target is the target JSON field.
	//
	// Required: true
	Target Target `json:"target"`
	// PriorityMode is the priorityMode JSON field.
	//
	// Required: true
	// Enum: ["balanced", "easy_first", "company_frequency", "knowledge_gaps"]
	PriorityMode string `json:"priorityMode"`
	// AvailableModes is the availableModes JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	AvailableModes []string `json:"availableModes"`
	// AlgorithmVersion is the algorithmVersion JSON field.
	//
	// Required: true
	AlgorithmVersion int `json:"algorithmVersion"`
	// Source is the source JSON field.
	//
	// Required: true
	Source string `json:"source"`
	// HorizonWeeks is the horizonWeeks JSON field.
	//
	// Required: true
	HorizonWeeks int `json:"horizonWeeks"`
	// WeeklyCapacity is the weeklyCapacity JSON field.
	//
	// Required: true
	WeeklyCapacity int `json:"weeklyCapacity"`
	// SelectedCount is the selectedCount JSON field.
	//
	// Required: true
	SelectedCount int `json:"selectedCount"`
	// ReserveCount is the reserveCount JSON field.
	//
	// Required: true
	ReserveCount int `json:"reserveCount"`
	// Configured is the configured JSON field.
	//
	// Required: true
	Configured bool `json:"configured"`
	// swagger:name generatedAt
	// GeneratedAt is the generatedAt JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	GeneratedAt *string `json:"generatedAt,omitempty"`
	// NextAction is the nextAction JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	NextAction *NextAction `json:"nextAction,omitempty"`
	// Weeks is the weeks JSON field.
	//
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
	// PlanKey is the planKey JSON field.
	//
	// Required: true
	PlanKey string `json:"planKey"`
	// Company is the company JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Company *Company `json:"company"`
	// swagger:name interviewDate
	// InterviewDate is the interviewDate JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date
	InterviewDate *string `json:"interviewDate"`
	// PriorityMode is the priorityMode JSON field.
	//
	// Required: true
	// Enum: ["balanced", "easy_first", "company_frequency", "knowledge_gaps"]
	PriorityMode string `json:"priorityMode"`
	// swagger:name generatedAt
	// GeneratedAt is the generatedAt JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	GeneratedAt *string `json:"generatedAt,omitempty"`
	// Active is the active JSON field.
	//
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
	// Company is the company JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Company *Company `json:"company"`
	// swagger:name interviewDate
	// InterviewDate is the interviewDate JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date
	InterviewDate *string `json:"interviewDate"`
	// Topics is the topics JSON field.
	//
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
	// ID is the id JSON field.
	//
	// Required: true
	ID string `json:"id"`
	// Label is the label JSON field.
	//
	// Required: true
	Label string `json:"label"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// Progress is the progress JSON field.
	//
	// Required: true
	Progress int `json:"progress"`
	// Focus is the focus JSON field.
	//
	// Required: true
	Focus string `json:"focus"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// Topics is the topics JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Topics []string `json:"topics"`
	// Items is the items JSON field.
	//
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
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// RelevantProblemCount is the relevantProblemCount JSON field.
	//
	// Required: true
	RelevantProblemCount int `json:"relevantProblemCount"`
	// DifficultyCounts is the difficultyCounts JSON field.
	//
	// Required: true
	DifficultyCounts map[string]int `json:"difficultyCounts"`
	// MasteryPercent is the masteryPercent JSON field.
	//
	// Required: true
	MasteryPercent int `json:"masteryPercent"`
	// PlanProgress is the planProgress JSON field.
	//
	// Required: true
	PlanProgress int `json:"planProgress"`
	// Stage is the stage JSON field.
	//
	// Required: true
	// Enum: ["theory", "tasks", "cards", "complete"]
	Stage string `json:"stage"`
	// Theory is the theory JSON field.
	//
	// Required: true
	Theory TheoryProgress `json:"theory"`
	// Tasks is the tasks JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tasks []Task `json:"tasks"`
	// CardProgress is the cardProgress JSON field.
	//
	// Required: true
	CardProgress CardProgress `json:"cardProgress"`
	// Reinforcement is the reinforcement JSON field.
	//
	// Required: true
	Reinforcement Reinforcement `json:"reinforcement"`
}

// TheoryProgress documents the RoadmapTheoryProgress JSON shape.
//
// swagger:model RoadmapTheoryProgress
type TheoryProgress struct {
	// Completed is the completed JSON field.
	//
	// Required: true
	Completed bool `json:"completed"`
	// swagger:name completedAt
	// CompletedAt is the completedAt JSON field.
	//
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
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// OriginalID is the originalId JSON field.
	//
	// Required: true
	OriginalID int64 `json:"originalId"`
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
	// Required: true
	Tier string `json:"tier"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// AccessStatus is the accessStatus JSON field.
	//
	// Required: false
	AccessStatus string `json:"accessStatus,omitempty"`
	// LastRating is the lastRating JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating,omitempty"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
	// ReviewCount is the reviewCount JSON field.
	//
	// Required: true
	ReviewCount int `json:"reviewCount"`
}

// CardProgress documents the RoadmapCardProgress JSON shape.
//
// swagger:model RoadmapCardProgress
type CardProgress struct {
	// Total is the total JSON field.
	//
	// Required: true
	Total int `json:"total"`
	// Reviewed is the reviewed JSON field.
	//
	// Required: true
	Reviewed int `json:"reviewed"`
	// Due is the due JSON field.
	//
	// Required: true
	Due int `json:"due"`
	// Reinforcement is the reinforcement JSON field.
	//
	// Required: true
	Reinforcement int `json:"reinforcement"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
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
	// Count is the count JSON field.
	//
	// Required: true
	Count int `json:"count"`
	// Due is the due JSON field.
	//
	// Required: true
	Due int `json:"due"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
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
	// Code is the code JSON field.
	//
	// Required: true
	Code string `json:"code"`
	// swagger:name completedAt
	// CompletedAt is the completedAt JSON field.
	//
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
	// Action is the action JSON field.
	//
	// Required: true
	// Enum: ["replace", "skip"]
	Action string `json:"action"`
}

// TaskAccessResolution documents the RoadmapTaskAccessResolution JSON shape.
//
// swagger:model RoadmapTaskAccessResolution
type TaskAccessResolution struct {
	// Action is the action JSON field.
	//
	// Required: true
	Action string `json:"action"`
	// OriginalProblemID is the originalProblemId JSON field.
	//
	// Required: true
	OriginalProblemID int64 `json:"originalProblemId"`
	// ReplacementProblemID is the replacementProblemId JSON field.
	//
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
