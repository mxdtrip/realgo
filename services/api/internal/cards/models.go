package cards

import "time"

const (
	CardTypePatternRecognition = "pattern_recognition"
	CardTypeAlgorithmMechanics = "algorithm_mechanics"
	CardTypeEdgeCase           = "edge_case"

	CardStatusNew      = "new"
	CardStatusDue      = "due"
	CardStatusLearning = "learning"
	CardStatusMastered = "mastered"

	SessionScopeDue        = "due"
	SessionScopeHardNormal = "hard_normal"
	SessionScopeAll        = "all"
	SessionScopePractice   = "practice"
)

// Card documents the CardsCard JSON shape.
//
// swagger:model CardsCard
type Card struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Type is the type JSON field.
	//
	// Required: true
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// Source is the source JSON field.
	//
	// Required: true
	Source Source `json:"source"`
	// Front is the front JSON field.
	//
	// Required: true
	Front string `json:"front"`
	// Back is the back JSON field.
	//
	// Required: true
	Back string `json:"back"`
	// Status is the status JSON field.
	//
	// Required: true
	// Enum: ["new", "due", "learning", "mastered"]
	Status string `json:"status"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"nextReviewAt"`
	// LastRating is the lastRating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// CreatedByAI is the createdByAi JSON field.
	//
	// Required: true
	CreatedByAI bool `json:"createdByAi"`
	// swagger:name createdAt
	// CreatedAt is the createdAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
}

// Source documents the CardsSource JSON shape.
//
// swagger:model CardsSource
type Source struct {
	// EntityType is the entityType JSON field.
	//
	// Required: true
	EntityType string `json:"entityType"`
	// EntityID is the entityId JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	EntityID *int64 `json:"entityId"`
	// Label is the label JSON field.
	//
	// Required: true
	Label string `json:"label"`
}

type seedCard struct {
	ID           string     `json:"id"`
	URL          string     `json:"url"`
	Type         string     `json:"type"`
	Source       seedSource `json:"source"`
	Front        string     `json:"front"`
	Back         string     `json:"back"`
	Status       string     `json:"status"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
	LastRating   *string    `json:"lastRating"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type seedSource struct {
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	Label      string `json:"label"`
}

type ListMeta struct {
	NextCursor *string `json:"nextCursor"`
}

type ListParams struct {
	Limit       int32
	Type        string
	PatternCode string
	Cursor      Cursor
	PageSize    int
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}

type CardRecord struct {
	ID               int64
	Type             string
	Front            string
	Back             string
	CreatedByAI      bool
	CreatedAt        time.Time
	SourceEntityType string
	SourceEntityID   *int64
	SourceLabel      string
	ScheduleID       *int64
	NextReviewAt     *time.Time
	LastRating       *string
	ReviewCount      int
	ReviewState      int
}

type SessionParams struct {
	Scope       string
	PatternCode string
	Limit       int32
}

// Session documents the CardsSession JSON shape.
//
// swagger:model CardsSession
type Session struct {
	// SessionID is the sessionId JSON field.
	//
	// Required: true
	SessionID string `json:"sessionId"`
	// Scope is the scope JSON field.
	//
	// Required: true
	// Enum: ["due", "hard_normal", "all", "practice"]
	Scope string `json:"scope"`
	// EstimatedMinutes is the estimatedMinutes JSON field.
	//
	// Required: true
	EstimatedMinutes int `json:"estimatedMinutes"`
	// Cards is the cards JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Cards []SessionCard `json:"cards"`
}

// SessionCard documents the CardsSessionCard JSON shape.
//
// swagger:model CardsSessionCard
type SessionCard struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Type is the type JSON field.
	//
	// Required: true
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// SourceLabel is the sourceLabel JSON field.
	//
	// Required: true
	SourceLabel string `json:"sourceLabel"`
	// Front is the front JSON field.
	//
	// Required: true
	Front string `json:"front"`
	// Back is the back JSON field.
	//
	// Required: true
	Back string `json:"back"`
	// CreatedByAI is the createdByAi JSON field.
	//
	// Required: true
	CreatedByAI bool `json:"createdByAi"`
	// ReviewState is the reviewState JSON field.
	//
	// Required: true
	ReviewState ReviewState `json:"reviewState"`
}

// ReviewState documents the CardsReviewState JSON shape.
//
// swagger:model CardsReviewState
type ReviewState struct {
	// Attempts is the attempts JSON field.
	//
	// Required: true
	Attempts int `json:"attempts"`
	// LastRating is the lastRating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	LastRating *string `json:"lastRating"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	// swagger:strfmt date-time
	NextReviewAt *time.Time `json:"nextReviewAt"`
}

// DueSummary is the un-capped due-today breakdown used by the /cards
// launcher's "Что повторяем сегодня" panel, distinct from Session (which
// caps at session_limit — one review session's worth, not "how many are
// due today").
// DueSummary documents the CardsDueSummary JSON shape.
//
// swagger:model CardsDueSummary
type DueSummary struct {
	// TotalDue is the totalDue JSON field.
	//
	// Required: true
	TotalDue int `json:"totalDue"`
	// EstimatedMinutes is the estimatedMinutes JSON field.
	//
	// Required: true
	EstimatedMinutes int `json:"estimatedMinutes"`
	// ByType is the byType JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ByType []DueTypeSummary `json:"byType"`
}

// DueTypeSummary documents the CardsDueTypeSummary JSON shape.
//
// swagger:model CardsDueTypeSummary
type DueTypeSummary struct {
	// Type is the type JSON field.
	//
	// Required: true
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// Count is the count JSON field.
	//
	// Required: true
	Count int `json:"count"`
	// SampleLabels holds up to 3 source titles (soonest-due first) so the UI
	// can show what's due without fetching every card's full content.
	// SampleLabels is the sampleLabels JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	SampleLabels []string `json:"sampleLabels"`
}

// RateRequest documents the CardsRateRequest JSON shape.
//
// Example: {"sessionId":"<sessionId>","rating":"normal","reviewedAt":"2026-10-05T16:00:00Z"}
//
// swagger:model CardsRateRequest
// swagger:additionalProperties false
type RateRequest struct {
	// sessionId из GET /me/cards/session. При отсутствии или невалидном значении используется упрощённый расчёт sessionProgress.
	//
	// Required: false
	SessionID string `json:"sessionId"`
	// Rating is the rating JSON field.
	//
	// Required: true
	// Enum: ["hard", "normal", "easy"]
	Rating string `json:"rating"`
	// swagger:name reviewedAt
	// ReviewedAt is the reviewedAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	ReviewedAt string `json:"reviewedAt"`
}

func (r RateRequest) ValidRating() bool {
	return validRating(r.Rating)
}

// RateResult documents the CardsRateResult JSON shape.
//
// swagger:model CardsRateResult
type RateResult struct {
	// CardID is the cardId JSON field.
	//
	// Required: true
	CardID int64 `json:"cardId"`
	// Rating is the rating JSON field.
	//
	// Required: true
	Rating string `json:"rating"`
	// swagger:name nextReviewAt
	// NextReviewAt is the nextReviewAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	NextReviewAt time.Time `json:"nextReviewAt"`
	// RepeatInCurrentSession is the repeatInCurrentSession JSON field.
	//
	// Required: true
	RepeatInCurrentSession bool `json:"repeatInCurrentSession"`
	// SessionProgress is the sessionProgress JSON field.
	//
	// Required: true
	SessionProgress SessionProgress `json:"sessionProgress"`
}

// SessionProgress documents the CardsSessionProgress JSON shape.
//
// swagger:model CardsSessionProgress
type SessionProgress struct {
	// Reviewed is the reviewed JSON field.
	//
	// Required: true
	Reviewed int `json:"reviewed"`
	// Total is the total JSON field.
	//
	// Required: true
	Total int `json:"total"`
	// Remaining is the remaining JSON field.
	//
	// Required: true
	Remaining int `json:"remaining"`
}

// --- CRUD types ---

// CreateCardInput is the input for creating a new card.
type CreateCardInput struct {
	Type        string
	Front       string
	Back        string
	Explanation *string
	SourceText  *string
	ProblemID   *int64
	PatternID   *int64
}

// UpdateCardInput contains the fields that may be patched on a card.
type UpdateCardInput struct {
	Type        *string
	Front       *string
	Back        *string
	Explanation *string
	SourceText  *string
}

// CardDetail is returned by CRUD endpoints and includes join fields.
// CardDetail documents the CardsCardDetail JSON shape.
//
// swagger:model CardsCardDetail
type CardDetail struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID int64 `json:"id"`
	// Type is the type JSON field.
	//
	// Required: true
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// Front is the front JSON field.
	//
	// Required: true
	Front string `json:"front"`
	// Back is the back JSON field.
	//
	// Required: true
	Back string `json:"back"`
	// Explanation is the explanation JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Explanation *string `json:"explanation"`
	// Source is the source JSON field.
	//
	// Required: true
	Source Source `json:"source"`
	// CreatedByAI is the createdByAi JSON field.
	//
	// Required: true
	CreatedByAI bool `json:"createdByAi"`
	// swagger:name createdAt
	// CreatedAt is the createdAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	CreatedAt time.Time `json:"createdAt"`
	// ProblemTitle is the problemTitle JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemTitle *string `json:"problemTitle"`
	// ProblemURL is the problemUrl JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemURL *string `json:"problemUrl"`
	// PatternName is the patternName JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternName *string `json:"patternName"`
}

// HTTP request types used by CRUD handlers only.
// createCardRequest documents the CardsCreateCardRequest JSON shape.
//
// problemId и patternId взаимоисключающие, но оба могут отсутствовать или быть null. Если цель задана, она должна существовать.
//
// Example: {"type":"pattern_recognition","front":"Какой подход использовать для поиска пары в отсортированном массиве?","back":"Два указателя.","problemId":123}
// Extensions:
// ---
// x-oneOf: [{"required":["problemId"],"properties":{"problemId":{"type":"integer","format":"int64"},"patternId":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true}}},{"required":["patternId"],"properties":{"patternId":{"type":"integer","format":"int64"},"problemId":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true}}},{"properties":{"problemId":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true},"patternId":{"type":"integer","format":"int64","x-nullable":true,"x-null-only":true}}}]
// ---
//
// swagger:model CardsCreateCardRequest
// swagger:additionalProperties false
type createCardRequest struct {
	// Type is the type JSON field.
	//
	// Required: true
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	Type string `json:"type"`
	// Непустое значение после trim.
	//
	// Required: true
	// Min Length: 1
	// Max Length: 500
	Front string `json:"front"`
	// Непустое значение после trim.
	//
	// Required: true
	// Min Length: 1
	// Max Length: 4000
	Back string `json:"back"`
	// Explanation is the explanation JSON field.
	//
	// Required: false
	// Max Length: 2000
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Explanation *string `json:"explanation"`
	// SourceText is the sourceText JSON field.
	//
	// Required: false
	// Max Length: 2000
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	SourceText *string `json:"sourceText"`
	// ProblemID is the problemId JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	ProblemID *int64 `json:"problemId"`
	// PatternID is the patternId JSON field.
	//
	// Required: false
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	PatternID *int64 `json:"patternId"`
}

// updateCardRequest documents the CardsUpdateCardRequest JSON shape.
//
// Нужно хотя бы одно не-null поле. Отсутствующее или null поле не изменяет сохранённое значение.
//
// Example: {"front":"Обновлённый вопрос","back":"Обновлённый ответ"}
// Extensions:
// ---
// x-anyOf: [{"required":["type"],"properties":{"type":{"type":"string"}}},{"required":["front"],"properties":{"front":{"type":"string"}}},{"required":["back"],"properties":{"back":{"type":"string"}}},{"required":["explanation"],"properties":{"explanation":{"type":"string"}}},{"required":["sourceText"],"properties":{"sourceText":{"type":"string"}}}]
// ---
//
// swagger:model CardsUpdateCardRequest
// swagger:additionalProperties false
type updateCardRequest struct {
	// Type is the type JSON field.
	//
	// Required: false
	// Enum: ["pattern_recognition", "algorithm_mechanics", "edge_case"]
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Type *string `json:"type"`
	// Непустое значение после trim.
	//
	// Required: false
	// Min Length: 1
	// Max Length: 500
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Front *string `json:"front"`
	// Непустое значение после trim.
	//
	// Required: false
	// Min Length: 1
	// Max Length: 4000
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Back *string `json:"back"`
	// Explanation is the explanation JSON field.
	//
	// Required: false
	// Max Length: 2000
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Explanation *string `json:"explanation"`
	// SourceText is the sourceText JSON field.
	//
	// Required: false
	// Max Length: 2000
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	SourceText *string `json:"sourceText"`
}
