package roadmap

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/realgo/services/api/internal/companies"
	"github.com/mxdtrip/realgo/services/api/internal/patterns"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres/db"
)

var (
	ErrUserNotFound        = errors.New("roadmap: user not found")
	ErrSubpatternNotFound  = errors.New("roadmap: subpattern not found")
	ErrRoadmapNotFound     = errors.New("roadmap: plan not found")
	ErrRoadmapTaskNotFound = errors.New("roadmap: task not found in active plan")
	ErrNoTaskReplacement   = errors.New("roadmap: no comparable replacement available")
)

type atlasSource interface {
	GetAtlas(ctx context.Context, userID int64, companyCode string) (patterns.AtlasResponse, error)
}

type pgRepository struct {
	pool  *pgxpool.Pool
	q     *db.Queries
	atlas atlasSource
	now   func() time.Time
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{
		pool:  pool,
		q:     db.New(pool),
		atlas: patterns.NewRepository(pool),
		now:   time.Now,
	}
}

func (r *pgRepository) Get(ctx context.Context, userID int64) (Response, error) {
	target, err := r.target(ctx, userID)
	if err != nil {
		return Response{}, err
	}

	config, err := r.q.GetUserRoadmapConfig(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		atlas, atlasErr := r.atlas.GetAtlas(ctx, userID, "")
		if atlasErr != nil {
			return Response{}, fmt.Errorf("roadmap: get legacy atlas: %w", atlasErr)
		}
		resp := buildResponse(target, atlas)
		resp.PriorityMode = PriorityBalanced
		resp.AvailableModes = availableModes(SourceCore, hasHistory(atlas))
		resp.AlgorithmVersion = algorithmVersion
		resp.Source = SourceCore
		resp.HorizonWeeks = max(1, len(resp.Weeks))
		resp.WeeklyCapacity = weeklyCapacityDefault
		resp.SelectedCount = len(resp.Weeks)
		resp.Configured = false
		return resp, nil
	}
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: get config: %w", err)
	}

	companyCode := textValue(config.CompanyCode)
	companyName := strings.TrimSpace(config.CompanyName)
	atlas, source, err := r.loadAtlas(ctx, userID, companyCode, companyName)
	if err != nil {
		return Response{}, err
	}
	target.InterviewDate = datePtr(config.InterviewDate)
	if companyCode != "" || companyName != "" {
		var code *string
		if companyCode != "" {
			value := companyCode
			code = &value
		}
		target.Company = &Company{Code: code, Name: companyName}
	} else {
		target.Company = nil
	}
	rows, err := r.q.ListUserRoadmapPlanItems(ctx, db.ListUserRoadmapPlanItemsParams{UserID: userID, PlanKey: config.PlanKey})
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: list plan items: %w", err)
	}
	items := storedRowsToPlanItems(rows, atlas)
	generatedAt := timePtrString(config.GeneratedAt)
	resp := responseFromPlan(
		target,
		config.PriorityMode,
		source,
		int(config.HorizonWeeks),
		int(config.WeeklyCapacity),
		items,
		true,
		generatedAt,
		atlas,
	)
	resp.PlanKey = config.PlanKey
	if err := r.enrichPlan(ctx, userID, companyCode, &resp); err != nil {
		return Response{}, err
	}
	return resp, nil
}

func (r *pgRepository) Preview(ctx context.Context, userID int64, req ConfigRequest) (Response, error) {
	resp, _, err := r.prepare(ctx, userID, req)
	return resp, err
}

func (r *pgRepository) Save(ctx context.Context, userID int64, req ConfigRequest) (Response, error) {
	resp, items, err := r.prepare(ctx, userID, req)
	if err != nil {
		return Response{}, err
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: begin save: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := r.q.WithTx(tx)

	planKey := roadmapPlanKey(req.CompanyCode, req.CompanyName)
	companyCode := pgtype.Text{}
	if code := strings.TrimSpace(req.CompanyCode); code != "" {
		companyCode = pgtype.Text{String: code, Valid: true}
	}
	interviewDate := pgtype.Timestamptz{}
	if req.InterviewDate != nil && strings.TrimSpace(*req.InterviewDate) != "" {
		parsed, parseErr := time.Parse(time.DateOnly, strings.TrimSpace(*req.InterviewDate))
		if parseErr != nil {
			return Response{}, fmt.Errorf("roadmap: parse interview date: %w", parseErr)
		}
		interviewDate = pgtype.Timestamptz{Time: parsed.Add(9 * time.Hour), Valid: true}
	}
	if err := q.DeactivateUserRoadmapConfigs(ctx, userID); err != nil {
		return Response{}, fmt.Errorf("roadmap: deactivate configs: %w", err)
	}
	if err := q.UpsertUserRoadmapConfig(ctx, db.UpsertUserRoadmapConfigParams{
		UserID:           userID,
		PlanKey:          planKey,
		CompanyCode:      companyCode,
		CompanyName:      strings.TrimSpace(req.CompanyName),
		InterviewDate:    interviewDate,
		PriorityMode:     resp.PriorityMode,
		HorizonWeeks:     int32(resp.HorizonWeeks),
		WeeklyCapacity:   int32(resp.WeeklyCapacity),
		AlgorithmVersion: algorithmVersion,
		Source:           resp.Source,
		PreserveProgress: req.PreserveProgress,
	}); err != nil {
		return Response{}, fmt.Errorf("roadmap: upsert config: %w", err)
	}
	if err := q.DeleteUserRoadmapPlanItems(ctx, db.DeleteUserRoadmapPlanItemsParams{UserID: userID, PlanKey: planKey}); err != nil {
		return Response{}, fmt.Errorf("roadmap: clear plan items: %w", err)
	}
	for _, item := range items {
		if err := q.InsertUserRoadmapPlanItem(ctx, db.InsertUserRoadmapPlanItemParams{
			UserID:         userID,
			PlanKey:        planKey,
			WeekIndex:      int32(item.WeekIndex),
			Position:       int32(item.Position),
			Selected:       item.Selected,
			SubpatternCode: item.Code,
		}); err != nil {
			return Response{}, fmt.Errorf("roadmap: insert plan item %s: %w", item.Code, err)
		}
	}

	if err := q.SetRoadmapTarget(ctx, db.SetRoadmapTargetParams{
		TargetCompany: strings.TrimSpace(req.CompanyName),
		InterviewDate: interviewDate,
		TargetTopics:  resp.Target.Topics,
		UserID:        userID,
	}); err != nil {
		return Response{}, fmt.Errorf("roadmap: set target: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Response{}, fmt.Errorf("roadmap: commit save: %w", err)
	}

	now := r.now().UTC().Format(time.RFC3339)
	resp.Configured = true
	resp.PlanKey = planKey
	resp.GeneratedAt = &now
	return resp, nil
}

func (r *pgRepository) prepare(ctx context.Context, userID int64, req ConfigRequest) (Response, []planItem, error) {
	if _, err := r.target(ctx, userID); err != nil {
		return Response{}, nil, err
	}

	atlas, source, err := r.loadAtlas(ctx, userID, strings.TrimSpace(req.CompanyCode), strings.TrimSpace(req.CompanyName))
	if err != nil {
		return Response{}, nil, err
	}
	target := targetFromRequest(req, atlas)
	mode := effectiveMode(req.PriorityMode, source, hasHistory(atlas))
	horizon := weeksUntil(req.InterviewDate, r.now())

	existing := []planItem{}
	if req.PreserveProgress {
		if config, configErr := r.q.GetUserRoadmapConfigByKey(ctx, db.GetUserRoadmapConfigByKeyParams{UserID: userID, PlanKey: roadmapPlanKey(req.CompanyCode, req.CompanyName)}); configErr == nil {
			rows, rowsErr := r.q.ListUserRoadmapPlanItems(ctx, db.ListUserRoadmapPlanItemsParams{UserID: userID, PlanKey: config.PlanKey})
			if rowsErr != nil {
				return Response{}, nil, fmt.Errorf("roadmap: list existing plan: %w", rowsErr)
			}
			existing = storedRowsToPlanItems(rows, atlas)
		} else if !errors.Is(configErr, pgx.ErrNoRows) {
			return Response{}, nil, fmt.Errorf("roadmap: get existing config: %w", configErr)
		}
	}

	items := generatePlan(atlas, source, mode, horizon, weeklyCapacityDefault, existing, req.PreserveProgress)
	if frozen := highestSelectedWeek(items); frozen > horizon {
		horizon = frozen
	}
	resp := responseFromPlan(target, mode, source, horizon, weeklyCapacityDefault, items, false, nil, atlas)
	resp.PlanKey = roadmapPlanKey(req.CompanyCode, req.CompanyName)
	companyCode := ""
	if atlas.Company != nil {
		companyCode = atlas.Company.Code
	}
	if err := r.enrichPlan(ctx, userID, companyCode, &resp); err != nil {
		return Response{}, nil, err
	}
	return resp, items, nil
}

func (r *pgRepository) enrichPlan(ctx context.Context, userID int64, companyCode string, resp *Response) error {
	codes := make([]string, 0, resp.SelectedCount)
	for _, week := range resp.Weeks {
		for _, item := range week.Items {
			codes = append(codes, item.Code)
		}
	}
	if len(codes) == 0 {
		return nil
	}

	problemRows, err := r.q.ListRoadmapPlanProblems(ctx, db.ListRoadmapPlanProblemsParams{
		UserID:          userID,
		CompanyCode:     companyCode,
		SubpatternCodes: codes,
	})
	if err != nil {
		return fmt.Errorf("roadmap: list plan problems: %w", err)
	}
	tasksByCode := make(map[string][]Task, len(codes))
	for _, row := range problemRows {
		tasksByCode[row.SubpatternCode] = append(tasksByCode[row.SubpatternCode], Task{
			ID:           row.ID,
			OriginalID:   row.ID,
			Title:        row.Title,
			URL:          row.Url,
			Difficulty:   row.Difficulty,
			Tier:         row.Tier,
			Status:       row.Status,
			LastRating:   textPtr(row.LastRating),
			NextReviewAt: timePtrString(row.NextReviewAt),
			ReviewCount:  int(row.ReviewCount),
		})
	}
	if err := r.applyTaskAccessOverrides(ctx, userID, resp.PlanKey, tasksByCode); err != nil {
		return err
	}

	cardRows, err := r.q.ListRoadmapPlanCardProgress(ctx, db.ListRoadmapPlanCardProgressParams{
		UserID:          userID,
		SubpatternCodes: codes,
	})
	if err != nil {
		return fmt.Errorf("roadmap: list plan card progress: %w", err)
	}
	cardsByCode := make(map[string]CardProgress, len(codes))
	for _, row := range cardRows {
		cardsByCode[row.SubpatternCode] = CardProgress{
			Total:         int(row.TotalCards),
			Reviewed:      int(row.ReviewedCards),
			Due:           int(row.DueCards),
			Reinforcement: int(row.ReinforcementCards),
			NextReviewAt:  timePtrString(row.NextReviewAt),
		}
	}

	theoryRows, err := r.q.ListRoadmapTheoryProgress(ctx, db.ListRoadmapTheoryProgressParams{
		UserID:          userID,
		SubpatternCodes: codes,
	})
	if err != nil {
		return fmt.Errorf("roadmap: list theory progress: %w", err)
	}
	theoryByCode := make(map[string]TheoryProgress, len(theoryRows))
	for _, row := range theoryRows {
		theoryByCode[row.SubpatternCode] = TheoryProgress{
			Completed:   row.TheoryCompletedAt.Valid,
			CompletedAt: timePtrString(row.TheoryCompletedAt),
		}
	}

	now := r.now()
	for weekIndex := range resp.Weeks {
		for itemIndex := range resp.Weeks[weekIndex].Items {
			item := &resp.Weeks[weekIndex].Items[itemIndex]
			item.Theory = theoryByCode[item.Code]
			item.Tasks = tasksByCode[item.Code]
			if item.Tasks == nil {
				item.Tasks = []Task{}
			}
			item.CardProgress = cardsByCode[item.Code]
			total, completed := 1+len(item.Tasks)+item.CardProgress.Total, item.CardProgress.Reviewed
			if item.Theory.Completed {
				completed++
			}
			reinforcement := Reinforcement{
				Count:        item.CardProgress.Reinforcement,
				Due:          item.CardProgress.Due,
				NextReviewAt: item.CardProgress.NextReviewAt,
			}
			for _, task := range item.Tasks {
				if task.Status == "solved" || task.Status == "reviewing" {
					completed++
				}
				if task.LastRating != nil && (*task.LastRating == "hard" || *task.LastRating == "normal") {
					reinforcement.Count++
				}
				if task.NextReviewAt != nil {
					if reviewAt, parseErr := time.Parse(time.RFC3339, *task.NextReviewAt); parseErr == nil {
						if !reviewAt.After(now) {
							reinforcement.Due++
						}
						reinforcement.NextReviewAt = earlierReview(reinforcement.NextReviewAt, task.NextReviewAt)
					}
				}
			}
			item.Reinforcement = reinforcement
			item.PlanProgress = percent(completed, total)
			item.Stage = learningStage(*item)
		}
	}
	recalculatePlanProgress(resp)
	resp.NextAction = buildNextAction(resp)
	return nil
}

type taskAccessOverride struct {
	status               string
	replacementProblemID *int64
}

// applyTaskAccessOverrides keeps the initial three task slots stable while
// allowing one inaccessible source task to be skipped or substituted. The
// override is scoped to the plan, so another company preparation is unchanged.
func (r *pgRepository) applyTaskAccessOverrides(ctx context.Context, userID int64, planKey string, tasksByCode map[string][]Task) error {
	if planKey == "" {
		return nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT problem_id, status, replacement_problem_id
		FROM user_roadmap_task_access_overrides
		WHERE user_id = $1 AND plan_key = $2`, userID, planKey)
	if err != nil {
		return fmt.Errorf("roadmap: list task access overrides: %w", err)
	}
	defer rows.Close()

	overrides := make(map[int64]taskAccessOverride)
	replacementIDs := make([]int64, 0)
	for rows.Next() {
		var problemID int64
		var status string
		var replacementProblemID *int64
		if err := rows.Scan(&problemID, &status, &replacementProblemID); err != nil {
			return fmt.Errorf("roadmap: scan task access override: %w", err)
		}
		overrides[problemID] = taskAccessOverride{status: status, replacementProblemID: replacementProblemID}
		if replacementProblemID != nil {
			replacementIDs = append(replacementIDs, *replacementProblemID)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("roadmap: iterate task access overrides: %w", err)
	}
	if len(overrides) == 0 {
		return nil
	}

	replacements, err := r.loadReplacementTasks(ctx, userID, replacementIDs)
	if err != nil {
		return err
	}
	for code, tasks := range tasksByCode {
		for index, task := range tasks {
			override, ok := overrides[task.OriginalID]
			if !ok {
				continue
			}
			switch override.status {
			case "skipped":
				tasks[index].AccessStatus = "unavailable"
				tasks[index].Status = "unavailable"
			case "replaced":
				if override.replacementProblemID == nil {
					continue
				}
				replacement, found := replacements[*override.replacementProblemID]
				if !found {
					continue
				}
				replacement.OriginalID = task.OriginalID
				replacement.Tier = task.Tier
				replacement.AccessStatus = "replaced"
				tasks[index] = replacement
			}
		}
		tasksByCode[code] = tasks
	}
	return nil
}

func (r *pgRepository) loadReplacementTasks(ctx context.Context, userID int64, ids []int64) (map[int64]Task, error) {
	result := make(map[int64]Task, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT
			pr.id,
			pr.title,
			pr.url,
			COALESCE(pr.difficulty, '')::text,
			COALESCE(upp.status, 'not_started')::text,
			rs.last_rating,
			rs.next_review_at,
			COALESCE(rs.review_count, 0)::integer
		FROM problems pr
		LEFT JOIN user_problem_progress upp ON upp.problem_id = pr.id AND upp.user_id = $1
		LEFT JOIN review_schedules rs ON rs.problem_id = pr.id AND rs.user_id = $1
		WHERE pr.id = ANY($2::bigint[])`, userID, ids)
	if err != nil {
		return nil, fmt.Errorf("roadmap: load replacement tasks: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var task Task
		var lastRating pgtype.Text
		var nextReviewAt pgtype.Timestamptz
		if err := rows.Scan(
			&task.ID,
			&task.Title,
			&task.URL,
			&task.Difficulty,
			&task.Status,
			&lastRating,
			&nextReviewAt,
			&task.ReviewCount,
		); err != nil {
			return nil, fmt.Errorf("roadmap: scan replacement task: %w", err)
		}
		task.OriginalID = task.ID
		task.LastRating = textPtr(lastRating)
		task.NextReviewAt = timePtrString(nextReviewAt)
		result[task.ID] = task
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("roadmap: iterate replacement tasks: %w", err)
	}
	return result, nil
}

func (r *pgRepository) ResolveTaskAccess(ctx context.Context, userID, requestedProblemID int64, action string) (TaskAccessResolution, error) {
	resp, err := r.Get(ctx, userID)
	if err != nil {
		return TaskAccessResolution{}, err
	}
	if !resp.Configured || resp.PlanKey == "" {
		return TaskAccessResolution{}, ErrRoadmapNotFound
	}

	var selected Task
	var subpatternCode string
	found := false
	for _, week := range resp.Weeks {
		for _, item := range week.Items {
			for _, task := range item.Tasks {
				if task.OriginalID == requestedProblemID || task.ID == requestedProblemID {
					selected = task
					subpatternCode = item.Code
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		return TaskAccessResolution{}, ErrRoadmapTaskNotFound
	}
	originalID := selected.OriginalID
	if originalID == 0 {
		originalID = selected.ID
	}

	resolution := TaskAccessResolution{Action: action, OriginalProblemID: originalID}
	storageStatus := "skipped"
	if action == "replace" {
		storageStatus = "replaced"
		excluded := make([]int64, 0)
		for _, week := range resp.Weeks {
			for _, item := range week.Items {
				if item.Code != subpatternCode {
					continue
				}
				for _, task := range item.Tasks {
					excluded = append(excluded, task.ID)
					if task.OriginalID != 0 && task.OriginalID != task.ID {
						excluded = append(excluded, task.OriginalID)
					}
				}
			}
		}
		companyCode := ""
		if resp.Target.Company != nil && resp.Target.Company.Code != nil {
			companyCode = *resp.Target.Company.Code
		}
		replacementID, replacementErr := r.findReplacementProblem(ctx, subpatternCode, companyCode, selected.Difficulty, selected.Tier, excluded)
		if replacementErr != nil {
			return TaskAccessResolution{}, replacementErr
		}
		resolution.ReplacementProblemID = &replacementID
	}

	var replacementID any
	if resolution.ReplacementProblemID != nil {
		replacementID = *resolution.ReplacementProblemID
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO user_roadmap_task_access_overrides (
			user_id, plan_key, problem_id, replacement_problem_id, status, updated_at
		) VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id, plan_key, problem_id) DO UPDATE SET
			replacement_problem_id = EXCLUDED.replacement_problem_id,
			status = EXCLUDED.status,
			updated_at = NOW()`, userID, resp.PlanKey, originalID, replacementID, storageStatus)
	if err != nil {
		return TaskAccessResolution{}, fmt.Errorf("roadmap: save task access override: %w", err)
	}
	return resolution, nil
}

func (r *pgRepository) findReplacementProblem(ctx context.Context, subpatternCode, companyCode, difficulty, tier string, excluded []int64) (int64, error) {
	var problemID int64
	err := r.pool.QueryRow(ctx, `
		SELECT pr.id
		FROM patterns sp
		JOIN problem_subpatterns ps ON ps.subpattern_id = sp.id
		JOIN problems pr ON pr.id = ps.problem_id
		LEFT JOIN companies co ON co.code = NULLIF($2::text, '')
		LEFT JOIN company_problems cp ON cp.problem_id = pr.id AND cp.company_id = co.id
		WHERE sp.code = $1
		  AND ($2::text = '' OR cp.problem_id IS NOT NULL)
		  AND NOT (pr.id = ANY($5::bigint[]))
		ORDER BY
			CASE WHEN LOWER(COALESCE(pr.difficulty, '')) = LOWER($3::text) THEN 0 ELSE 1 END,
			CASE WHEN COALESCE(ps.tier, '') = $4::text THEN 0 ELSE 1 END,
			CASE ps.tier WHEN 'foundational' THEN 0 WHEN 'core' THEN 1 WHEN 'advanced' THEN 2 ELSE 3 END,
			CASE LOWER(COALESCE(pr.difficulty, '')) WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 WHEN 'hard' THEN 2 ELSE 3 END,
			COALESCE(cp.evidence_count, 0) DESC,
			ps.position NULLS LAST,
			pr.id
		LIMIT 1`, subpatternCode, companyCode, difficulty, tier, excluded).Scan(&problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNoTaskReplacement
	}
	if err != nil {
		return 0, fmt.Errorf("roadmap: find replacement task: %w", err)
	}
	return problemID, nil
}

func learningStage(item Item) string {
	if !item.Theory.Completed {
		return StageTheory
	}
	for _, task := range item.Tasks {
		if task.Status != "solved" && task.Status != "reviewing" && task.AccessStatus != "unavailable" {
			return StageTasks
		}
	}
	if item.CardProgress.Reviewed < item.CardProgress.Total {
		return StageCards
	}
	return StageComplete
}

func earlierReview(current, candidate *string) *string {
	if candidate == nil {
		return current
	}
	if current == nil {
		return candidate
	}
	currentAt, currentErr := time.Parse(time.RFC3339, *current)
	candidateAt, candidateErr := time.Parse(time.RFC3339, *candidate)
	if candidateErr == nil && (currentErr != nil || candidateAt.Before(currentAt)) {
		return candidate
	}
	return current
}

func buildNextAction(resp *Response) *NextAction {
	for _, week := range resp.Weeks {
		if week.Status == "done" {
			continue
		}
		for _, item := range week.Items {
			action := NextAction{Stage: item.Stage, PatternCode: item.Code, WeekID: week.ID}
			switch item.Stage {
			case StageTheory:
				action.Title = "Изучить " + item.Name
				action.Description = item.Name + " · этап 1 из 3 · теория"
				action.Href = "/patterns/" + url.PathEscape(item.Code) + "?from=roadmap"
			case StageTasks:
				for _, task := range item.Tasks {
					if task.Status == "solved" || task.Status == "reviewing" || task.AccessStatus == "unavailable" {
						continue
					}
					action.Title = task.Title
					action.Description = item.Name + " · этап 2 из 3 · задача"
					action.Href = task.URL
					break
				}
			case StageCards:
				action.Title = "Вопросы по " + item.Name
				action.Description = item.Name + " · этап 3 из 3 · карточки"
				action.Href = "/patterns/" + url.PathEscape(item.Code) + "/session"
			default:
				continue
			}
			if action.Href != "" {
				return &action
			}
		}
	}
	return nil
}

func (r *pgRepository) CompleteTheory(ctx context.Context, userID int64, code string) (TheoryCompletion, error) {
	completedAt, err := r.q.CompleteRoadmapTheory(ctx, db.CompleteRoadmapTheoryParams{
		UserID:         userID,
		SubpatternCode: strings.TrimSpace(code),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return TheoryCompletion{}, ErrSubpatternNotFound
	}
	if err != nil {
		return TheoryCompletion{}, fmt.Errorf("roadmap: complete theory: %w", err)
	}
	return TheoryCompletion{
		Code:        strings.TrimSpace(code),
		CompletedAt: completedAt.Time.UTC().Format(time.RFC3339),
	}, nil
}

func (r *pgRepository) List(ctx context.Context, userID int64) ([]Summary, error) {
	if _, err := r.target(ctx, userID); err != nil {
		return nil, err
	}
	rows, err := r.q.ListUserRoadmapConfigs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("roadmap: list configs: %w", err)
	}
	summaries := make([]Summary, 0, len(rows))
	for _, row := range rows {
		var company *Company
		if row.CompanyCode.Valid || strings.TrimSpace(row.CompanyName) != "" {
			var code *string
			if row.CompanyCode.Valid {
				value := row.CompanyCode.String
				code = &value
			}
			company = &Company{Code: code, Name: row.CompanyName}
		}
		summaries = append(summaries, Summary{
			PlanKey:       row.PlanKey,
			Company:       company,
			InterviewDate: datePtr(row.InterviewDate),
			PriorityMode:  row.PriorityMode,
			GeneratedAt:   timePtrString(row.GeneratedAt),
			Active:        row.IsActive,
		})
	}
	return summaries, nil
}

func (r *pgRepository) Activate(ctx context.Context, userID int64, planKey string) (Response, error) {
	config, err := r.q.GetUserRoadmapConfigByKey(ctx, db.GetUserRoadmapConfigByKeyParams{
		UserID: userID, PlanKey: strings.TrimSpace(planKey),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Response{}, ErrRoadmapNotFound
	}
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: get config to activate: %w", err)
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: begin activation: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := r.q.WithTx(tx)
	if err := q.DeactivateUserRoadmapConfigs(ctx, userID); err != nil {
		return Response{}, fmt.Errorf("roadmap: deactivate configs: %w", err)
	}
	if _, err := q.ActivateUserRoadmapConfig(ctx, db.ActivateUserRoadmapConfigParams{
		UserID: userID, PlanKey: config.PlanKey,
	}); err != nil {
		return Response{}, fmt.Errorf("roadmap: activate config: %w", err)
	}
	if err := q.SetRoadmapTarget(ctx, db.SetRoadmapTargetParams{
		TargetCompany: config.CompanyName,
		InterviewDate: config.InterviewDate,
		TargetTopics:  []string{},
		UserID:        userID,
	}); err != nil {
		return Response{}, fmt.Errorf("roadmap: sync active target: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Response{}, fmt.Errorf("roadmap: commit activation: %w", err)
	}
	return r.Get(ctx, userID)
}

func recalculatePlanProgress(resp *Response) {
	overallSum, itemCount := 0, 0
	activeAssigned := false
	for weekIndex := range resp.Weeks {
		week := &resp.Weeks[weekIndex]
		if len(week.Items) == 0 {
			continue
		}
		weekSum := 0
		weekCompleted := true
		for _, item := range week.Items {
			weekSum += item.PlanProgress
			overallSum += item.PlanProgress
			itemCount++
			if item.Stage != StageComplete {
				weekCompleted = false
			}
		}
		week.Progress = int(math.Round(float64(weekSum) / float64(len(week.Items))))
		switch {
		case weekCompleted:
			week.Status = "done"
		case !activeAssigned:
			week.Status = "active"
			activeAssigned = true
		default:
			week.Status = "todo"
		}
	}
	if itemCount > 0 {
		resp.OverallProgress = int(math.Round(float64(overallSum) / float64(itemCount)))
	}
}

func (r *pgRepository) loadAtlas(ctx context.Context, userID int64, companyCode, companyName string) (patterns.AtlasResponse, string, error) {
	key := companyCode
	if key == "" {
		key = companyName
	}
	if key != "" {
		atlas, err := r.atlas.GetAtlas(ctx, userID, key)
		if err == nil && atlas.Company != nil {
			return atlas, SourceCompany, nil
		}
		if err != nil && !errors.Is(err, patterns.ErrCompanyNotFound) {
			return patterns.AtlasResponse{}, "", fmt.Errorf("roadmap: get company atlas: %w", err)
		}
	}
	atlas, err := r.atlas.GetAtlas(ctx, userID, "")
	if err != nil {
		return patterns.AtlasResponse{}, "", fmt.Errorf("roadmap: get core atlas: %w", err)
	}
	return atlas, SourceCore, nil
}

func (r *pgRepository) Clear(ctx context.Context, userID int64) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("roadmap: begin clear: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := r.q.WithTx(tx)
	if err := q.DeleteUserRoadmapConfig(ctx, userID); err != nil {
		return fmt.Errorf("roadmap: delete config: %w", err)
	}
	if _, err := q.ActivateLatestUserRoadmapConfig(ctx, userID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("roadmap: activate fallback config: %w", err)
	}
	remaining, err := q.GetUserRoadmapConfig(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		if err := q.ClearRoadmapTarget(ctx, userID); err != nil {
			return fmt.Errorf("roadmap: clear target: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("roadmap: get fallback config: %w", err)
	} else if err := q.SetRoadmapTarget(ctx, db.SetRoadmapTargetParams{
		TargetCompany: remaining.CompanyName,
		InterviewDate: remaining.InterviewDate,
		TargetTopics:  []string{},
		UserID:        userID,
	}); err != nil {
		return fmt.Errorf("roadmap: sync fallback target: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("roadmap: commit clear: %w", err)
	}
	return nil
}

func roadmapPlanKey(companyCode, companyName string) string {
	if code := strings.TrimSpace(companyCode); code != "" {
		return code
	}
	if name := strings.ToLower(strings.TrimSpace(companyName)); name != "" {
		digest := sha256.Sum256([]byte(name))
		return "custom:" + hex.EncodeToString(digest[:8])
	}
	return "core"
}

func (r *pgRepository) target(ctx context.Context, userID int64) (Target, error) {
	row, err := r.q.GetRoadmapUserTarget(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Target{}, ErrUserNotFound
		}
		return Target{}, fmt.Errorf("roadmap: get user target: %w", err)
	}
	return targetFromRow(row), nil
}

func targetFromRow(row db.GetRoadmapUserTargetRow) Target {
	var company *Company
	if name := textPtr(row.TargetCompany); name != nil {
		company = buildCompany(*name)
	}
	topics := row.TargetTopics
	if topics == nil {
		topics = []string{}
	}
	return Target{Company: company, InterviewDate: datePtr(row.InterviewDate), Topics: topics}
}

func targetFromRequest(req ConfigRequest, atlas patterns.AtlasResponse) Target {
	name := strings.TrimSpace(req.CompanyName)
	code := strings.TrimSpace(req.CompanyCode)
	if atlas.Company != nil {
		if name == "" {
			name = atlas.Company.Name
		}
		if code == "" {
			code = atlas.Company.Code
		}
	}
	var company *Company
	if name != "" || code != "" {
		var codePtr *string
		if code != "" {
			value := code
			codePtr = &value
		}
		if name == "" {
			name = code
		}
		company = &Company{Code: codePtr, Name: name}
	}
	var interviewDate *string
	if req.InterviewDate != nil && strings.TrimSpace(*req.InterviewDate) != "" {
		value := strings.TrimSpace(*req.InterviewDate)
		interviewDate = &value
	}
	return Target{Company: company, InterviewDate: interviewDate, Topics: []string{}}
}

func buildCompany(name string) *Company {
	if found, ok := companies.Lookup(name); ok {
		code := found.ID
		return &Company{Code: &code, Name: found.Name}
	}
	return &Company{Code: nil, Name: name}
}

func generatePlan(atlas patterns.AtlasResponse, source, mode string, horizon, capacity int, existing []planItem, preserve bool) []planItem {
	candidates := buildCandidates(atlas, source)
	sortCandidates(candidates, mode, source)

	byCode := make(map[string]planItem, len(candidates))
	for _, candidate := range candidates {
		byCode[candidate.Code] = candidate
	}
	for _, sub := range atlas.Subpatterns {
		if _, ok := byCode[sub.Code]; !ok {
			byCode[sub.Code] = itemFromSubpattern(sub, nil)
		}
	}

	freezeWeek := 0
	frozen := []planItem{}
	frozenCodes := map[string]bool{}
	if preserve {
		freezeWeek = freezeThroughActiveWeek(existing)
		for _, stored := range existing {
			if !stored.Selected || stored.WeekIndex <= 0 || stored.WeekIndex > freezeWeek {
				continue
			}
			item := byCode[stored.Code]
			item.WeekIndex = stored.WeekIndex
			item.Selected = true
			frozen = append(frozen, item)
			frozenCodes[item.Code] = true
		}
		sort.SliceStable(frozen, func(i, j int) bool {
			if frozen[i].WeekIndex != frozen[j].WeekIndex {
				return frozen[i].WeekIndex < frozen[j].WeekIndex
			}
			return existingPosition(existing, frozen[i].Code) < existingPosition(existing, frozen[j].Code)
		})
	}

	remaining := make([]planItem, 0, len(candidates))
	for _, candidate := range candidates {
		if !frozenCodes[candidate.Code] {
			remaining = append(remaining, candidate)
		}
	}
	if horizon < freezeWeek {
		horizon = freezeWeek
	}
	availableSlots := max(0, horizon-freezeWeek) * capacity
	selectedNewCount := min(len(remaining), availableSlots)

	result := make([]planItem, 0, len(frozen)+len(remaining))
	position := 1
	for _, item := range frozen {
		item.Position = position
		position++
		result = append(result, item)
	}
	for index, item := range remaining {
		item.Position = position
		position++
		if index < selectedNewCount {
			item.Selected = true
			item.WeekIndex = freezeWeek + index/capacity + 1
		} else {
			item.Selected = false
			item.WeekIndex = 0
		}
		result = append(result, item)
	}
	return result
}

func buildCandidates(atlas patterns.AtlasResponse, source string) []planItem {
	problemSeen := map[string]map[int64]bool{}
	difficulties := map[string]map[string]int{}
	if atlas.Company != nil {
		for _, problem := range atlas.Company.RelevantProblems {
			if problemSeen[problem.SubpatternCode] == nil {
				problemSeen[problem.SubpatternCode] = map[int64]bool{}
				difficulties[problem.SubpatternCode] = map[string]int{}
			}
			if problemSeen[problem.SubpatternCode][problem.ID] {
				continue
			}
			problemSeen[problem.SubpatternCode][problem.ID] = true
			difficulty := strings.ToLower(problem.Difficulty)
			if difficulty != "easy" && difficulty != "medium" && difficulty != "hard" {
				difficulty = "unknown"
			}
			difficulties[problem.SubpatternCode][difficulty]++
		}
	}

	items := make([]planItem, 0, len(atlas.Subpatterns))
	for _, sub := range atlas.Subpatterns {
		if source == SourceCompany && (sub.Relevance == nil || relevanceWeight(sub.Relevance.Relevance) == 0) {
			continue
		}
		var counts map[string]int
		if len(difficulties[sub.Code]) > 0 {
			counts = difficulties[sub.Code]
		}
		item := itemFromSubpattern(sub, counts)
		item.RelevantProblemCount = len(problemSeen[sub.Code])
		if sub.Relevance != nil {
			item.EvidenceCount = sub.Relevance.EvidenceCount
			item.Confidence = sub.Relevance.Confidence
		}
		items = append(items, item)
	}
	return items
}

func itemFromSubpattern(sub patterns.AtlasSubpattern, difficultyCounts map[string]int) planItem {
	counts := copyCounts(difficultyCounts)
	if len(counts) == 0 {
		counts = copyCounts(sub.Stats.DifficultyCounts)
	}
	return planItem{
		Item: Item{
			Code:             sub.Code,
			Name:             sub.Name,
			DifficultyCounts: counts,
			MasteryPercent:   sub.Mastery.Percent,
			PlanProgress:     sub.Mastery.Percent,
			Stage:            StageTheory,
			Tasks:            []Task{},
		},
		TaxonomyPosition: sub.Position,
		DifficultyScore:  difficultyScore(counts),
	}
}

func sortCandidates(items []planItem, mode, source string) {
	maxProblems := 0
	for _, item := range items {
		maxProblems = max(maxProblems, item.RelevantProblemCount)
	}
	for i := range items {
		importance := 0.0
		if maxProblems > 0 {
			importance = math.Log1p(float64(items[i].RelevantProblemCount)) / math.Log1p(float64(maxProblems))
		} else if len(items) > 1 {
			importance = 1 - float64(i)/float64(len(items)-1)
		} else {
			importance = 1
		}
		importance *= confidenceFactor(items[i].Confidence)
		gap := float64(100-items[i].MasteryPercent) / 100
		ease := (3 - items[i].DifficultyScore) / 2
		switch mode {
		case PriorityKnowledgeGaps:
			items[i].Score = .65*gap + .25*importance + .10*ease
		default:
			items[i].Score = .50*importance + .30*gap + .20*ease
		}
	}

	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		switch mode {
		case PriorityEasyFirst:
			if a.DifficultyScore != b.DifficultyScore {
				return a.DifficultyScore < b.DifficultyScore
			}
			if a.RelevantProblemCount != b.RelevantProblemCount {
				return a.RelevantProblemCount > b.RelevantProblemCount
			}
		case PriorityCompanyFrequency:
			if a.RelevantProblemCount != b.RelevantProblemCount {
				return a.RelevantProblemCount > b.RelevantProblemCount
			}
			if a.EvidenceCount != b.EvidenceCount {
				return a.EvidenceCount > b.EvidenceCount
			}
		default:
			if math.Abs(a.Score-b.Score) > .000001 {
				return a.Score > b.Score
			}
		}
		if a.MasteryPercent != b.MasteryPercent {
			return a.MasteryPercent < b.MasteryPercent
		}
		if a.TaxonomyPosition != b.TaxonomyPosition {
			return a.TaxonomyPosition < b.TaxonomyPosition
		}
		return a.Code < b.Code
	})

	_ = source // reserved for future source-specific weighting without changing the contract
}

func responseFromPlan(target Target, mode, source string, horizon, capacity int, items []planItem, configured bool, generatedAt *string, atlas patterns.AtlasResponse) Response {
	selected := make([]planItem, 0, len(items))
	reserveCount := 0
	for _, item := range items {
		if item.Selected {
			selected = append(selected, item)
		} else {
			reserveCount++
		}
	}
	target.Topics = make([]string, 0, len(selected))
	for _, item := range selected {
		target.Topics = append(target.Topics, item.Code)
	}

	weeks := make([]Week, horizon)
	for index := range weeks {
		weeks[index] = Week{
			ID:     fmt.Sprintf("week_%02d", index+1),
			Label:  fmt.Sprintf("week %02d", index+1),
			Topics: []string{},
			Items:  []Item{},
			Status: "todo",
		}
	}
	for _, item := range selected {
		if item.WeekIndex <= 0 || item.WeekIndex > len(weeks) {
			continue
		}
		week := &weeks[item.WeekIndex-1]
		week.Topics = append(week.Topics, item.Code)
		week.Items = append(week.Items, item.Item)
	}

	activeAssigned := false
	overallSum := 0
	for index := range weeks {
		week := &weeks[index]
		if len(week.Items) == 0 {
			week.Title = "Повторение и mock interview"
			week.Focus = "закрепить пройденное и отработать формат интервью"
			continue
		}
		names := make([]string, 0, len(week.Items))
		progressSum := 0
		relevantProblems := 0
		for _, item := range week.Items {
			names = append(names, item.Name)
			progressSum += item.MasteryPercent
			overallSum += item.MasteryPercent
			relevantProblems += item.RelevantProblemCount
		}
		week.Progress = int(math.Round(float64(progressSum) / float64(len(week.Items))))
		week.Title = buildWeekTitle(names)
		if source == SourceCompany && relevantProblems > 0 {
			week.Focus = fmt.Sprintf("%d релевантных задач · %s", relevantProblems, strings.Join(names, ", "))
		} else {
			week.Focus = "разобрать: " + strings.Join(names, ", ")
		}
		if week.Progress >= 100 {
			week.Status = "done"
		} else if !activeAssigned {
			week.Status = "active"
			activeAssigned = true
		}
	}

	overall := 0
	if len(selected) > 0 {
		overall = int(math.Round(float64(overallSum) / float64(len(selected))))
	}
	return Response{
		OverallProgress:  overall,
		Target:           target,
		PriorityMode:     mode,
		AvailableModes:   availableModes(source, hasHistory(atlas)),
		AlgorithmVersion: algorithmVersion,
		Source:           source,
		HorizonWeeks:     horizon,
		WeeklyCapacity:   capacity,
		SelectedCount:    len(selected),
		ReserveCount:     reserveCount,
		Configured:       configured,
		GeneratedAt:      generatedAt,
		Weeks:            weeks,
	}
}

func storedRowsToPlanItems(rows []db.ListUserRoadmapPlanItemsRow, atlas patterns.AtlasResponse) []planItem {
	byCode := map[string]planItem{}
	for _, candidate := range buildCandidates(atlas, func() string {
		if atlas.Company != nil {
			return SourceCompany
		}
		return SourceCore
	}()) {
		byCode[candidate.Code] = candidate
	}
	for _, sub := range atlas.Subpatterns {
		if _, ok := byCode[sub.Code]; !ok {
			byCode[sub.Code] = itemFromSubpattern(sub, nil)
		}
	}
	items := make([]planItem, 0, len(rows))
	for _, row := range rows {
		item := byCode[row.Code]
		item.Code = row.Code
		item.Name = row.Name
		item.TaxonomyPosition = int(row.TaxonomyPosition.Int32)
		item.WeekIndex = int(row.WeekIndex)
		item.Position = int(row.Position)
		item.Selected = row.Selected
		items = append(items, item)
	}
	return items
}

func freezeThroughActiveWeek(items []planItem) int {
	maxWeek := highestSelectedWeek(items)
	for week := 1; week <= maxWeek; week++ {
		count, progress := 0, 0
		for _, item := range items {
			if item.Selected && item.WeekIndex == week {
				count++
				progress += item.MasteryPercent
			}
		}
		if count == 0 {
			continue
		}
		if progress/count < 100 {
			return week
		}
	}
	return maxWeek
}

func highestSelectedWeek(items []planItem) int {
	result := 0
	for _, item := range items {
		if item.Selected {
			result = max(result, item.WeekIndex)
		}
	}
	return result
}

func existingPosition(items []planItem, code string) int {
	for _, item := range items {
		if item.Code == code {
			return item.Position
		}
	}
	return math.MaxInt
}

func weeksUntil(value *string, now time.Time) int {
	if value == nil || strings.TrimSpace(*value) == "" {
		return 4
	}
	target, err := time.Parse(time.DateOnly, strings.TrimSpace(*value))
	if err != nil {
		return 4
	}
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	days := int(math.Ceil(target.Sub(today).Hours() / 24))
	weeks := int(math.Ceil(float64(days) / 7))
	return min(52, max(1, weeks))
}

func effectiveMode(requested, source string, history bool) string {
	if !isPriorityMode(requested) {
		requested = PriorityBalanced
	}
	if requested == PriorityCompanyFrequency && source != SourceCompany {
		return PriorityBalanced
	}
	if requested == PriorityKnowledgeGaps && !history {
		return PriorityBalanced
	}
	return requested
}

func isPriorityMode(value string) bool {
	for _, mode := range allPriorityModes {
		if value == mode {
			return true
		}
	}
	return false
}

func availableModes(source string, history bool) []string {
	modes := []string{PriorityBalanced, PriorityEasyFirst}
	if source == SourceCompany {
		modes = append(modes, PriorityCompanyFrequency)
	}
	if history {
		modes = append(modes, PriorityKnowledgeGaps)
	}
	return modes
}

func hasHistory(atlas patterns.AtlasResponse) bool {
	for _, sub := range atlas.Subpatterns {
		if sub.Mastery.Percent > 0 || sub.Stats.SolvedCount > 0 || sub.Stats.AttemptCount > 0 {
			return true
		}
	}
	return false
}

func relevanceWeight(value string) int {
	switch value {
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

func confidenceFactor(value string) float64 {
	switch value {
	case "high":
		return 1
	case "medium":
		return .85
	case "low":
		return .65
	default:
		return 1
	}
}

func difficultyScore(counts map[string]int) float64 {
	total := counts["easy"] + counts["medium"] + counts["hard"]
	if total == 0 {
		return 2
	}
	return float64(counts["easy"]+2*counts["medium"]+3*counts["hard"]) / float64(total)
}

func copyCounts(source map[string]int) map[string]int {
	result := map[string]int{}
	for key, value := range source {
		result[key] = value
	}
	return result
}

func buildWeekTitle(names []string) string {
	if len(names) == 0 {
		return "Повторение и mock interview"
	}
	if len(names) <= 2 {
		return strings.Join(names, ", ")
	}
	return fmt.Sprintf("%s + %d тем", names[0], len(names)-1)
}

// buildResponse preserves the legacy family-based response for accounts that
// have not committed a v1 personal plan yet. The web migrates those accounts
// through PUT /me/roadmap and stops using this path afterwards.
func buildResponse(target Target, atlas patterns.AtlasResponse) Response {
	subpatternByCode := make(map[string]patterns.AtlasSubpattern, len(atlas.Subpatterns))
	for _, sub := range atlas.Subpatterns {
		subpatternByCode[sub.Code] = sub
	}
	families := append([]patterns.AtlasFamily(nil), atlas.Families...)
	sort.SliceStable(families, func(i, j int) bool { return families[i].Position < families[j].Position })
	weeks := make([]Week, 0, len(families))
	totalProblems, totalSolved := 0, 0
	for i, family := range families {
		familyTotal, familySolved := 0, 0
		weakestCode := ""
		weakestPercent := 101
		for _, code := range family.SubpatternCodes {
			sub, ok := subpatternByCode[code]
			if !ok {
				continue
			}
			familyTotal += sub.Stats.ProblemCount
			familySolved += sub.Stats.SolvedCount
			if weakestCode == "" || sub.Mastery.Percent < weakestPercent {
				weakestCode = sub.Code
				weakestPercent = sub.Mastery.Percent
			}
		}
		progress := percent(familySolved, familyTotal)
		totalProblems += familyTotal
		totalSolved += familySolved
		topics := []string{}
		if weakestCode != "" {
			topics = []string{weakestCode}
		}
		weeks = append(weeks, Week{
			ID:       fmt.Sprintf("week_%02d", i+1),
			Label:    fmt.Sprintf("week %02d", i+1),
			Title:    family.Name,
			Progress: progress,
			Focus:    family.Description,
			Status:   roadmapStatus(progress),
			Topics:   topics,
			Items:    []Item{},
		})
	}
	return Response{OverallProgress: percent(totalSolved, totalProblems), Target: target, Weeks: weeks}
}

func roadmapStatus(progress int) string {
	switch {
	case progress >= 100:
		return "done"
	case progress > 0:
		return "active"
	default:
		return "todo"
	}
}

func percent(done, total int) int {
	if total <= 0 || done <= 0 {
		return 0
	}
	return int(float64(done)/float64(total)*100 + 0.5)
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid || value.String == "" {
		return nil
	}
	text := value.String
	return &text
}

func textValue(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func datePtr(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	date := value.Time.UTC().Format(time.DateOnly)
	return &date
}

func timePtrString(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.UTC().Format(time.RFC3339)
	return &formatted
}
