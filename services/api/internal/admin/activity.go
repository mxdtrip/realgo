package admin

import (
	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
)

func UserProblemProgress(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "user_problem_progress", "Problem progress", "Per-user problem state", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Problem", "problem_id", db.Bigint, true, false},
		listField{"Status", "status", db.Varchar, true, false},
		listField{"Rating", "rating", db.Text, true, false},
		listField{"Confidence", "confidence", db.Int, false, true},
		listField{"Note", "note", db.Text, false, false},
		listField{"First seen", "first_seen_at", db.Timestamp, false, true},
		listField{"Solved", "solved_at", db.Timestamp, false, true},
		listField{"Last reviewed", "last_reviewed_at", db.Timestamp, false, true},
	)
}

func ReviewSchedules(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "review_schedules", "Review schedules", "Current FSRS scheduling state", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Problem", "problem_id", db.Bigint, true, false},
		listField{"Pattern", "pattern_id", db.Bigint, true, false},
		listField{"Card", "card_id", db.Bigint, true, false},
		listField{"Next review", "next_review_at", db.Timestamp, false, true},
		listField{"Last rating", "last_rating", db.Text, true, false},
		listField{"Review count", "review_count", db.Int, false, true},
		listField{"State", "state", db.Smallint, true, false},
		listField{"Lapses", "lapses", db.Int, false, true},
		listField{"Stability", "stability", db.Doubleprecision, false, true},
		listField{"Difficulty", "difficulty", db.Doubleprecision, false, true},
		listField{"Updated", "updated_at", db.Timestamp, false, true},
	)
}

func ReviewAttempts(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "review_attempts", "Review attempts", "Append-only review history", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Problem", "problem_id", db.Bigint, true, false},
		listField{"Pattern", "pattern_id", db.Bigint, true, false},
		listField{"Card", "card_id", db.Bigint, true, false},
		listField{"Type", "review_type", db.Varchar, true, false},
		listField{"Rating", "rating", db.Text, true, false},
		listField{"Correct", "was_correct", db.Boolean, true, false},
		listField{"Duration", "duration_sec", db.Int, false, true},
		listField{"Created", "created_at", db.Timestamp, false, true},
	)
}

func QuizAnswers(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "quiz_answers", "Quiz answers", "Recorded user quiz answers", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Question", "question_id", db.Bigint, true, false},
		listField{"Selected option", "selected_option", db.Int, false, false},
		listField{"Correct", "was_correct", db.Boolean, true, false},
		listField{"Created", "created_at", db.Timestamp, false, true},
	)
}

func ExtensionEvents(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "extension_events", "Extension events", "Browser extension event log", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Platform", "platform_id", db.Bigint, true, false},
		listField{"Type", "event_type", db.Varchar, true, false},
		listField{"Title", "title", db.Text, true, false},
		listField{"URL", "url", db.Text, false, false},
		listField{"Rating", "rating", db.Text, true, false},
		listField{"Version", "extension_version", db.Varchar, true, false},
		listField{"Event time", "event_time", db.Timestamp, false, true},
		listField{"Payload", "raw_payload", db.JSON, false, false},
	)
}

func AIRequestLogs(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "ai_request_logs", "AI requests", "AI provider request log", "id", db.Bigint,
		listField{"ID", "id", db.Bigint, false, true},
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Problem", "problem_id", db.Bigint, true, false},
		listField{"Feature", "feature", db.Varchar, true, false},
		listField{"Provider", "provider", db.Varchar, true, false},
		listField{"Model", "model", db.Text, true, false},
		listField{"Prompt", "prompt_version", db.Text, true, false},
		listField{"Input tokens", "input_tokens", db.Int, false, true},
		listField{"Output tokens", "output_tokens", db.Int, false, true},
		listField{"Cost", "estimated_cost", db.Numeric, false, true},
		listField{"Status", "status", db.Varchar, true, false},
		listField{"Created", "created_at", db.Timestamp, false, true},
	)
}

func UserPracticePatterns(ctx *context.Context) table.Table {
	t := readOnlyTable(ctx, "user_practice_patterns", "Practice patterns", "Active user practice patterns", "user_id", db.Bigint,
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Pattern", "pattern_id", db.Bigint, true, false},
		listField{"Added", "added_at", db.Timestamp, false, true},
	)
	t.GetInfo().HideDetailButton()
	return t
}

func UserRoadmapConfigs(ctx *context.Context) table.Table {
	return readOnlyTable(ctx, "user_roadmap_configs", "Roadmap configs", "Generated user roadmap settings", "user_id", db.Bigint,
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Company", "company_code", db.Text, true, false},
		listField{"Priority", "priority_mode", db.Text, true, false},
		listField{"Horizon", "horizon_weeks", db.Int, false, true},
		listField{"Weekly capacity", "weekly_capacity", db.Int, false, true},
		listField{"Algorithm", "algorithm_version", db.Int, true, false},
		listField{"Source", "source", db.Text, true, false},
		listField{"Generated", "generated_at", db.Timestamp, false, true},
		listField{"Updated", "updated_at", db.Timestamp, false, true},
	)
}

func UserRoadmapPlanItems(ctx *context.Context) table.Table {
	t := readOnlyTable(ctx, "user_roadmap_plan_items", "Roadmap plans", "Generated user roadmap entries", "user_id", db.Bigint,
		listField{"User", "user_id", db.Bigint, true, false},
		listField{"Subpattern", "subpattern_id", db.Bigint, true, false},
		listField{"Week", "week_index", db.Int, true, true},
		listField{"Position", "position", db.Int, false, true},
		listField{"Selected", "selected", db.Boolean, true, false},
	)
	t.GetInfo().HideDetailButton()
	return t
}
