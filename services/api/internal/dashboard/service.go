package dashboard

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/mxdtrip/realgo/services/api/internal/patterns"
	"github.com/mxdtrip/realgo/services/api/internal/roadmap"
)

const (
	reviewPreviewLimit = 5
	weakPatternsLimit  = 5
	// activityWindowDays matches the dashboard heatmap: 4 rows × 14 columns.
	activityWindowDays = 56
)

type repository interface {
	GetMetrics(ctx context.Context, userID int64) (Metrics, error)
	ListActivity(ctx context.Context, userID int64, days int32) ([]ActivityDay, error)
	ListReviewPreview(ctx context.Context, userID int64, limit int32) ([]ReviewPreview, error)
	GetNextReview(ctx context.Context, userID int64) (*ReviewPreview, error)
}

type weakPatternRepository interface {
	ListWeak(ctx context.Context, userID int64, limit int32) ([]patterns.WeakPattern, error)
}

type roadmapSource interface {
	Get(ctx context.Context, userID int64) (roadmap.Response, error)
}

type Service struct {
	repo     repository
	weakRepo weakPatternRepository
	roadmap  roadmapSource
}

func NewService(repo repository, weakRepo weakPatternRepository, roadmapSources ...roadmapSource) *Service {
	var source roadmapSource
	if len(roadmapSources) > 0 {
		source = roadmapSources[0]
	}
	return &Service{repo: repo, weakRepo: weakRepo, roadmap: source}
}

func (s *Service) Get(ctx context.Context, userID int64) (Response, error) {
	metrics, err := s.repo.GetMetrics(ctx, userID)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: get metrics: %w", err)
	}

	reviews, err := s.repo.ListReviewPreview(ctx, userID, reviewPreviewLimit)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: list review preview: %w", err)
	}

	nextReview, err := s.repo.GetNextReview(ctx, userID)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: get next review: %w", err)
	}

	activityDays, err := s.repo.ListActivity(ctx, userID, activityWindowDays)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: list activity: %w", err)
	}

	weakPatterns := make([]patterns.WeakPattern, 0)
	if s.weakRepo != nil {
		weakPatterns, err = s.weakRepo.ListWeak(ctx, userID, weakPatternsLimit)
		if err != nil {
			return Response{}, fmt.Errorf("dashboard: list weak patterns: %w", err)
		}
	}

	var activePlan *roadmap.Response
	if s.roadmap != nil {
		plan, roadmapErr := s.roadmap.Get(ctx, userID)
		if roadmapErr == nil {
			activePlan = &plan
		}
	}

	var planAction *roadmap.NextAction
	if metrics.DueCount == 0 && activePlan != nil {
		planAction = activePlan.NextAction
	}

	reviewPreview := mapReviewPreview(reviews)
	return Response{
		NextAction:    buildNextAction(metrics, reviewPreview, mapOptionalReview(nextReview), planAction),
		Stats:         buildStats(metrics, activePlan),
		ReviewPreview: reviewPreview,
		WeakPatterns:  mapWeakPatterns(weakPatterns),
		Activity:      buildActivity(activityDays),
	}, nil
}

func buildActivity(days []ActivityDay) Activity {
	total := 0
	for _, day := range days {
		total += day.Count
	}
	if days == nil {
		days = []ActivityDay{}
	}
	return Activity{
		Days:         days,
		ActiveDays:   len(days),
		TotalReviews: total,
	}
}

func buildStats(metrics Metrics, activePlan *roadmap.Response) []Stat {
	readiness := clamp(metrics.Readiness, 0, 100)
	stats := []Stat{
		{
			Key:          "today_queue",
			Label:        "today queue",
			Value:        metrics.DueCount,
			DisplayValue: strconv.Itoa(metrics.DueCount),
			Hint:         fmt.Sprintf("%d задач, %d карточек, %d паттернов", metrics.DueProblemCount, metrics.DueCardCount, metrics.DuePatternCount),
			Tone:         toneWhen(metrics.DueCount > 0, statToneAccent, statToneDefault),
		},
		{
			Key:          "solved_total",
			Label:        "solved",
			Value:        metrics.SolvedCount,
			DisplayValue: strconv.Itoa(metrics.SolvedCount),
			Hint:         "решено задач всего",
			Tone:         statToneDefault,
		},
		{
			Key:          "streak",
			Label:        "streak",
			Value:        metrics.CurrentStreak,
			DisplayValue: strconv.Itoa(metrics.CurrentStreak),
			Hint:         "дней подряд активности",
			Tone:         toneWhen(metrics.CurrentStreak > 0, statToneAccent, statToneDefault),
		},
		{
			Key:          "readiness",
			Label:        "readiness",
			Value:        readiness,
			DisplayValue: fmt.Sprintf("%d%%", readiness),
			Hint:         readinessHint(metrics.ProgressCount),
			Tone:         readinessTone(readiness, metrics.ProgressCount),
		},
	}

	if activePlan != nil && activePlan.Configured {
		progress := clamp(activePlan.OverallProgress, 0, 100)
		hint := "общий прогресс активного плана"
		if activePlan.Target.Company != nil && activePlan.Target.Company.Name != "" {
			hint = fmt.Sprintf("план подготовки · %s", activePlan.Target.Company.Name)
		}
		stats = append(stats, Stat{
			Key:          "roadmap_progress",
			Label:        "roadmap progress",
			Value:        progress,
			DisplayValue: fmt.Sprintf("%d%%", progress),
			Hint:         hint,
			Tone:         roadmapProgressTone(progress),
			Href:         "/roadmap",
		})
	}

	return stats
}

func roadmapProgressTone(progress int) string {
	switch {
	case progress >= 100:
		return statToneSuccess
	case progress > 0:
		return statToneAccent
	default:
		return statToneDefault
	}
}

func buildNextAction(metrics Metrics, dueItems []ReviewPreviewItem, nextReview *ReviewPreviewItem, planAction *roadmap.NextAction) NextAction {
	if metrics.DueCount > 0 && len(dueItems) > 0 {
		first := dueItems[0]
		dueAt := first.DueAt
		return NextAction{
			Type:        actionType(first.Type),
			Title:       fmt.Sprintf("%d %s на сегодня", metrics.DueCount, pluralReview(metrics.DueCount)),
			Description: nonEmpty(first.Meta, first.Title),
			Href:        actionHref(first.Type),
			DueAt:       &dueAt,
		}
	}
	if planAction != nil {
		return NextAction{
			Type:        nextActionTypeRoadmapStep,
			Title:       planAction.Title,
			Description: planAction.Description,
			Href:        planAction.Href,
		}
	}
	if nextReview == nil {
		return NextAction{
			Type:        nextActionTypeRoadmapStep,
			Title:       "Начните с первой задачи",
			Description: "NeetCode 150",
			Href:        "/roadmap",
		}
	}
	dueAt := nextReview.DueAt
	return NextAction{
		Type:        nextActionTypeRoadmapStep,
		Title:       "На сегодня всё готово",
		Description: "Следующее повторение: " + nonEmpty(nextReview.Meta, nextReview.Title),
		Href:        "/roadmap",
		DueAt:       &dueAt,
	}
}

func pluralReview(value int) string {
	mod10 := value % 10
	mod100 := value % 100
	if mod10 == 1 && mod100 != 11 {
		return "повторение"
	}
	if mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) {
		return "повторения"
	}
	return "повторений"
}

func mapReviewPreview(items []ReviewPreview) []ReviewPreviewItem {
	mapped := make([]ReviewPreviewItem, 0, len(items))
	for _, item := range items {
		mapped = append(mapped, mapReview(item))
	}
	return mapped
}

func mapOptionalReview(item *ReviewPreview) *ReviewPreviewItem {
	if item == nil {
		return nil
	}
	mapped := mapReview(*item)
	return &mapped
}

func mapReview(item ReviewPreview) ReviewPreviewItem {
	return ReviewPreviewItem{
		ID:         strconv.FormatInt(item.ID, 10),
		Type:       reviewType(item.EntityType),
		Title:      nonEmpty(item.Title, "Review"),
		Meta:       reviewMeta(item.PatternName, item.Difficulty),
		DueAt:      item.DueAt,
		LastRating: item.LastRating,
	}
}

func mapWeakPatterns(items []patterns.WeakPattern) []WeakPattern {
	mapped := make([]WeakPattern, 0, len(items))
	for _, item := range items {
		mapped = append(mapped, WeakPattern{
			ID:         patternID(item.PatternCode),
			Name:       item.Pattern,
			Confidence: weakPatternConfidence(item.HardCount, item.ReviewCount),
			Signal:     fmt.Sprintf("%d hard из %d повторений", item.HardCount, item.ReviewCount),
		})
	}
	return mapped
}

func reviewType(entityType string) string {
	switch entityType {
	case "card":
		return reviewPreviewTypeCard
	case "pattern":
		return reviewPreviewTypePattern
	default:
		return reviewPreviewTypeProblem
	}
}

func actionType(reviewType string) string {
	switch reviewType {
	case reviewPreviewTypeCard:
		return nextActionTypeCardSession
	case reviewPreviewTypePattern:
		return nextActionTypePatternReview
	default:
		return nextActionTypeProblemReview
	}
}

func actionHref(reviewType string) string {
	if reviewType == reviewPreviewTypeCard {
		return "/cards/session"
	}
	return "/queue"
}

func reviewMeta(patternName, difficulty string) string {
	parts := make([]string, 0, 2)
	if strings.TrimSpace(patternName) != "" {
		parts = append(parts, strings.TrimSpace(patternName))
	}
	if strings.TrimSpace(difficulty) != "" {
		parts = append(parts, strings.TrimSpace(difficulty))
	}
	return strings.Join(parts, " · ")
}

func patternID(code string) string {
	code = strings.TrimSpace(code)
	if strings.HasPrefix(code, "pat_") {
		return code
	}
	return "pat_" + code
}

func weakPatternConfidence(hardCount, reviewCount int) int {
	if reviewCount <= 0 {
		return 100
	}
	// A ratio remains meaningful as history grows: five hard ratings among a
	// hundred reviews should not look worse than three among four.
	hardPercent := (hardCount*100 + reviewCount/2) / reviewCount
	return clamp(100-hardPercent, 0, 100)
}

func readinessHint(progressCount int) string {
	if progressCount == 0 {
		return "нет данных по прогрессу"
	}
	return "готовность к интервью"
}

func readinessTone(readiness, progressCount int) string {
	if progressCount == 0 {
		return statToneDefault
	}
	if readiness >= 70 {
		return statToneSuccess
	}
	if readiness >= 40 {
		return statToneWarning
	}
	return statToneDanger
}

func toneWhen(condition bool, trueTone, falseTone string) string {
	if condition {
		return trueTone
	}
	return falseTone
}

func nonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
