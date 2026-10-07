package ai

type AssistantRole string

const (
	AssistantRoleUser      AssistantRole = "user"
	AssistantRoleAssistant AssistantRole = "assistant"
)

// AssistantHintRequest describes one hint turn from the browser extension.
// AssistantHintRequest documents the AiAssistantHintRequest JSON shape.
//
// Example: {"platform":"leetcode","taskTitle":"Two Sum","taskUrl":"https://leetcode.com/problems/two-sum/","platformTaskSlug":"two-sum","message":"Помоги выбрать подход","hintLevel":1}
//
// swagger:model AiAssistantHintRequest
// swagger:additionalProperties false
type AssistantHintRequest struct {
	// Перед проверкой применяется lowercase и trim.
	//
	// Required: true
	// Enum: ["leetcode", "geeksforgeeks", "hackerrank", "codeforces"]
	Platform string `json:"platform"`
	// Required: true
	// Min Length: 1
	TaskTitle string `json:"taskTitle"`
	// Обязательная непустая строка; handler не проверяет формат URI или домен.
	//
	// Required: true
	// Min Length: 1
	TaskURL string `json:"taskUrl"`
	// Required: true
	// Min Length: 1
	PlatformTaskSlug string `json:"platformTaskSlug"`
	// Required: false
	Difficulty string `json:"difficulty"`
	// Используются первые 12 значений после trim и удаления пустых/дубликатов.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Tags []string `json:"tags"`
	// TaskDescription is the problem statement scraped from the page,
	// best-effort (the problems table itself stores no statement text).
	// После trim обрезается до 6000 символов.
	//
	// Required: false
	TaskDescription string `json:"taskDescription"`
	// При пустом значении используется мягкая наводка по умолчанию.
	//
	// Required: false
	// Max Length: 1200
	Message string `json:"message"`
	// Значение нормализуется к диапазону 1–3: nudge, approach, reveal.
	//
	// Required: false
	HintLevel int `json:"hintLevel"`
	// Используются последние 8 сообщений. Пустые сообщения пропускаются; до 1200 символов в одном сообщении.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	History []AssistantMessage `json:"history"`
}

// AssistantMessage is a compact conversation item. Only the last few turns are
// accepted by the handler; this is context, not durable chat history.
// AssistantMessage documents the AiAssistantMessage JSON shape.
//
// swagger:model AiAssistantMessage
type AssistantMessage struct {
	// Required: true
	// Enum: ["user", "assistant"]
	Role AssistantRole `json:"role"`
	// Required: true
	// Max Length: 1200
	Content string `json:"content"`
}

// AssistantPattern is the known taxonomy context for this problem, when the
// problem exists in the catalog.
// AssistantPattern documents the AiAssistantPattern JSON shape.
//
// swagger:model AiAssistantPattern
type AssistantPattern struct {
	// Required: true
	Code string `json:"code"`
	// Required: true
	Name string `json:"name"`
	// Required: false
	Tier string `json:"tier,omitempty"`
	// Required: false
	Families string `json:"families,omitempty"`
	// Required: false
	Description string `json:"description,omitempty"`
}

// AssistantHintInput is the provider-facing shape after validation and DB
// enrichment.
type AssistantHintInput struct {
	Platform   string
	Slug       string
	Title      string
	URL        string
	Difficulty string
	Tags       []string
	// Description is the problem statement, best-effort — the extension
	// scrapes it from the page since the problems table stores none.
	Description   string
	Message       string
	HintLevel     int
	History       []AssistantMessage
	ProblemKnown  bool
	ProblemID     int64
	Patterns      []AssistantPattern
	PromptVersion string
}

// AssistantHintResponse is returned to the extension.
// AssistantHintResponse documents the AiAssistantHintResponse JSON shape.
//
// swagger:model AiAssistantHintResponse
type AssistantHintResponse struct {
	// Required: true
	Hint string `json:"hint"`
	// Required: false
	Question string `json:"question,omitempty"`
	// Required: true
	// Enum: ["nudge", "approach", "reveal"]
	Stage string `json:"stage"`
	// Required: true
	ProblemKnown bool `json:"problemKnown"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Patterns []AssistantPattern `json:"patterns,omitempty"`
}

// GenerateCardRequest describes the context for card generation.
// GenerateCardRequest documents the AiGenerateCardRequest JSON shape.
//
// Example: {"problem_id":123}
//
// swagger:model AiGenerateCardRequest
// swagger:additionalProperties false
type GenerateCardRequest struct {
	// Only problem-based generation is supported. PatternID must remain nil.
	// Required: true
	ProblemID *int64 `json:"problem_id"`
	// Для этой ручки непустой pattern_id пока не поддерживается; передавайте только problem_id.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// x-null-only: true
	// ---
	PatternID *int64 `json:"pattern_id"`
	// CardType is accepted for compatibility but is currently ignored.
	// Принимается, но текущий handler не фильтрует генерацию по этому полю.
	//
	// Required: false
	CardType string `json:"card_type"`
}

// GenerateQuizRequest describes the context for quiz question generation.
// GenerateQuizRequest documents the AiGenerateQuizRequest JSON shape.
//
// Ровно один из problem_id и pattern_id должен быть не-null. difficulty принимается без проверки enum. Текущая реализация — заглушка.
//
// Example: {"problem_id":123,"difficulty":"medium"}
// Extensions:
// ---
// x-oneOf: [{"required":["problem_id"],"properties":{"problem_id":{"type":"integer","format":"int64"},"pattern_id":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true}}},{"required":["pattern_id"],"properties":{"pattern_id":{"type":"integer","format":"int64"},"problem_id":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true}}}]
// ---
//
// swagger:model AiGenerateQuizRequest
// swagger:additionalProperties false
type GenerateQuizRequest struct {
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemID *int64 `json:"problem_id"`
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternID *int64 `json:"pattern_id"`
	// Required: false
	Difficulty string `json:"difficulty"`
}
