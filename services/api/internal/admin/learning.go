package admin

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/GoAdminGroup/go-admin/template/types/form"
)

func RoadmapItems(ctx *context.Context) table.Table {
	t := relationTable(ctx, "roadmap_items", "Roadmap items", "Roadmap catalog entries")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Roadmap", "roadmap_code", db.Text)
	info.AddField("Pattern", "pattern_id", db.Bigint).FieldFilterable()
	info.AddField("Problem", "problem_id", db.Bigint).FieldFilterable()
	info.AddField("Position", "position", db.Int).FieldSortable()
	addILikeFilters(info, ilikeFilter{"Roadmap", "roadmap_items", "roadmap_code"})
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Roadmap", "roadmap_code", db.Text, form.Text).FieldMust()
	f.AddField("Pattern", "pattern_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id").FieldMust()
	f.AddField("Problem", "problem_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("problems", "title", "id").FieldMust()
	f.AddField("Position", "position", db.Int, form.Number).FieldMust()
	f.SetPostValidator(required("roadmap_code", "pattern_id", "problem_id", "position"))
	return t
}

func QuizQuestions(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("id", db.Bigint))
	info := t.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("User", "user_id", db.Bigint).FieldFilterable()
	info.AddField("Problem", "problem_id", db.Bigint).FieldFilterable()
	info.AddField("Pattern", "pattern_id", db.Bigint).FieldFilterable()
	info.AddField("Question", "question", db.Text)
	info.AddField("Difficulty", "difficulty", db.Varchar)
	info.AddField("AI", "created_by_ai", db.Boolean).FieldFilterable()
	info.AddField("Created", "created_at", db.Timestamp).FieldSortable()
	addILikeFilters(info,
		ilikeFilter{"Question", "quiz_questions", "question"},
		ilikeFilter{"Difficulty", "quiz_questions", "difficulty"},
	)
	info.SetTable("quiz_questions").SetTitle("Quiz questions").SetDescription("Problem and pattern quizzes")
	f := t.GetForm()
	f.AddField("ID", "id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
	f.AddField("User", "user_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("users", "email", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Problem", "problem_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("problems", "title", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Pattern", "pattern_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("patterns", "name", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Question", "question", db.Text, form.TextArea).FieldMust()
	f.AddField("Options", "options", db.JSON, form.Code).FieldMust()
	f.AddField("Correct option (0-based)", "correct_option", db.Int, form.Number).FieldMust()
	f.AddField("Explanation", "explanation", db.Text, form.TextArea).FieldPostFilterFn(nullableValue)
	f.AddField("Difficulty", "difficulty", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{option("None", ""), option("Easy", "easy"), option("Medium", "medium"), option("Hard", "hard")}).
		FieldPostFilterFn(nullableValue)
	f.AddField("Created by AI", "created_by_ai", db.Boolean, form.SelectSingle).
		FieldOptions(types.FieldOptions{option("No", "false"), option("Yes", "true")}).FieldDefault("false")
	f.AddField("Created", "created_at", db.Timestamp, form.Default).FieldNotAllowEdit().FieldDisableWhenCreate()
	f.SetTable("quiz_questions").SetTitle("Quiz questions").SetDescription("Create and edit quiz questions").SetPostValidator(validateQuizQuestion)
	return t
}

func validateQuizQuestion(values formValues.Values) error {
	if strings.TrimSpace(values.Get("question")) == "" {
		return errors.New("question must not be empty")
	}
	if (values.Get("problem_id") == "") == (values.Get("pattern_id") == "") {
		return errors.New("choose exactly one problem or pattern")
	}
	var options []string
	if err := json.Unmarshal([]byte(values.Get("options")), &options); err != nil || len(options) == 0 {
		return errors.New("options must be a non-empty JSON string array")
	}
	correct, err := strconv.Atoi(values.Get("correct_option"))
	if err != nil || correct < 0 || correct >= len(options) {
		return errors.New("correct_option must reference an option")
	}
	return nil
}
