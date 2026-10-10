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

type ConfigRequest struct {
	CompanyCode      string  `json:"companyCode"`
	CompanyName      string  `json:"companyName"`
	InterviewDate    *string `json:"interviewDate"`
	PriorityMode     string  `json:"priorityMode"`
	PreserveProgress bool    `json:"preserveProgress"`
}

type Response struct {
	PlanKey          string      `json:"planKey,omitempty"`
	OverallProgress  int         `json:"overallProgress"`
	Target           Target      `json:"target"`
	PriorityMode     string      `json:"priorityMode"`
	AvailableModes   []string    `json:"availableModes"`
	AlgorithmVersion int         `json:"algorithmVersion"`
	Source           string      `json:"source"`
	HorizonWeeks     int         `json:"horizonWeeks"`
	WeeklyCapacity   int         `json:"weeklyCapacity"`
	SelectedCount    int         `json:"selectedCount"`
	ReserveCount     int         `json:"reserveCount"`
	Configured       bool        `json:"configured"`
	GeneratedAt      *string     `json:"generatedAt,omitempty"`
	NextAction       *NextAction `json:"nextAction,omitempty"`
	Weeks            []Week      `json:"weeks"`
}

type Summary struct {
	PlanKey       string   `json:"planKey"`
	Company       *Company `json:"company"`
	InterviewDate *string  `json:"interviewDate"`
	PriorityMode  string   `json:"priorityMode"`
	GeneratedAt   *string  `json:"generatedAt,omitempty"`
	Active        bool     `json:"active"`
}

type NextAction struct {
	Stage       string `json:"stage"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Href        string `json:"href"`
	PatternCode string `json:"patternCode"`
	WeekID      string `json:"weekId"`
}

type Target struct {
	Company       *Company `json:"company"`
	InterviewDate *string  `json:"interviewDate"`
	Topics        []string `json:"topics"`
}

type Company struct {
	Code *string `json:"code"`
	Name string  `json:"name"`
}

type Week struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Title    string   `json:"title"`
	Progress int      `json:"progress"`
	Focus    string   `json:"focus"`
	Status   string   `json:"status"`
	Topics   []string `json:"topics"`
	Items    []Item   `json:"items"`
}

type Item struct {
	Code                 string         `json:"code"`
	Name                 string         `json:"name"`
	RelevantProblemCount int            `json:"relevantProblemCount"`
	DifficultyCounts     map[string]int `json:"difficultyCounts"`
	MasteryPercent       int            `json:"masteryPercent"`
	PlanProgress         int            `json:"planProgress"`
	Stage                string         `json:"stage"`
	Theory               TheoryProgress `json:"theory"`
	Tasks                []Task         `json:"tasks"`
	CardProgress         CardProgress   `json:"cardProgress"`
	Reinforcement        Reinforcement  `json:"reinforcement"`
}

type TheoryProgress struct {
	Completed   bool    `json:"completed"`
	CompletedAt *string `json:"completedAt,omitempty"`
}

type Task struct {
	ID           int64   `json:"id"`
	OriginalID   int64   `json:"originalId"`
	Title        string  `json:"title"`
	URL          string  `json:"url"`
	Difficulty   string  `json:"difficulty"`
	Tier         string  `json:"tier"`
	Status       string  `json:"status"`
	AccessStatus string  `json:"accessStatus,omitempty"`
	LastRating   *string `json:"lastRating,omitempty"`
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
	ReviewCount  int     `json:"reviewCount"`
}

type CardProgress struct {
	Total         int     `json:"total"`
	Reviewed      int     `json:"reviewed"`
	Due           int     `json:"due"`
	Reinforcement int     `json:"reinforcement"`
	NextReviewAt  *string `json:"nextReviewAt,omitempty"`
}

type Reinforcement struct {
	Count        int     `json:"count"`
	Due          int     `json:"due"`
	NextReviewAt *string `json:"nextReviewAt,omitempty"`
}

type TheoryCompletion struct {
	Code        string `json:"code"`
	CompletedAt string `json:"completedAt"`
}

type TaskAccessRequest struct {
	Action string `json:"action"`
}

type TaskAccessResolution struct {
	Action               string `json:"action"`
	OriginalProblemID    int64  `json:"originalProblemId"`
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
