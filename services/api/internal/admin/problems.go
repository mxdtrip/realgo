package admin

import (
	"errors"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/parameter"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/GoAdminGroup/go-admin/template/types/form"
	"github.com/lib/pq"
)

const (
	duplicateProblemSlugError = "задача с таким External slug уже существует для выбранной платформы"
	difficultyRequiredError   = "необходимо выбрать Difficulty"
	sourceRequiredError       = "необходимо выбрать Source"
	platformRequiredError     = "необходимо выбрать Platform"
	externalSlugRequiredError = "external slug must not be empty"
)

type problemTable struct{ table.Table }

func (t problemTable) UpdateData(ctx *context.Context, values formValues.Values) error {
	return problemFormError(t.Table.UpdateData(ctx, values))
}

func (t problemTable) InsertData(ctx *context.Context, values formValues.Values) error {
	return problemFormError(t.Table.InsertData(ctx, values))
}

func (t problemTable) Copy() table.Table { return problemTable{t.Table.Copy()} }

func problemFormError(err error) error {
	var pgErr *pq.Error
	if !errors.As(err, &pgErr) {
		return err
	}

	switch pgErr.Constraint {
	case "problems_platform_id_external_slug_key":
		return errors.New(duplicateProblemSlugError)
	case "problems_difficulty_check":
		return errors.New(difficultyRequiredError)
	case "problems_source_type_check":
		return errors.New(sourceRequiredError)
	}
	return err
}

func platformDisplay(value types.FieldModel) interface{} {
	if value.Value != "" {
		return value.Value
	}
	if name, ok := value.Row["platforms"+parameter.FilterParamJoinInfix+"name"].(string); ok {
		return name
	}
	return ""
}

// Problems exposes the problem catalog with validated editing.
func Problems(ctx *context.Context) table.Table {
	cfg := table.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey("id", db.Bigint)

	problems := table.NewDefaultTable(ctx, cfg)
	info := problems.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Title", "title", db.Text)
	info.AddField("Platform", "name", db.Varchar).FieldJoin(types.Join{
		Field:     "platform_id",
		JoinField: "id",
		Table:     "platforms",
	}).FieldDisplay(platformDisplay)
	info.AddField("External slug", "external_slug", db.Text)
	info.AddField("Difficulty", "difficulty", db.Varchar)
	info.AddField("Source", "source_type", db.Varchar)
	info.AddField("URL", "url", db.Text)
	info.AddField("Updated", "updated_at", db.Timestamp).FieldSortable()
	addILikeFilters(info,
		ilikeFilter{"Title", "problems", "title"},
		ilikeFilter{"Platform", "platforms", "name"},
		ilikeFilter{"External slug", "problems", "external_slug"},
		ilikeFilter{"Difficulty", "problems", "difficulty"},
		ilikeFilter{"Source", "problems", "source_type"},
	)
	info.SetTable("problems").
		SetTitle("Problems").
		SetDescription("Problem catalog")

	edit := problems.GetForm()
	edit.AddField("ID", "id", db.Bigint, form.Default).
		FieldDisplayButCanNotEditWhenUpdate().
		FieldDisableWhenCreate()
	edit.AddField("Platform", "platform_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("platforms", "name", "id").
		FieldOptionsTableProcessFn(blankOption).
		FieldMust()
	edit.AddField("External slug", "external_slug", db.Text, form.Text).FieldMust()
	edit.AddField("Title", "title", db.Text, form.Text).FieldMust()
	edit.AddField("Difficulty", "difficulty", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{
			{Text: "Select difficulty", Value: ""},
			{Text: "Easy", Value: "easy"},
			{Text: "Medium", Value: "medium"},
			{Text: "Hard", Value: "hard"},
		}).
		FieldMust()
	edit.AddField("Source", "source_type", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{
			{Text: "Select source", Value: ""},
			{Text: "Roadmap", Value: "roadmap"},
			{Text: "Manual", Value: "manual"},
			{Text: "Extension", Value: "extension"},
			{Text: "AI", Value: "ai"},
			{Text: "Dataset", Value: "dataset"},
		}).
		FieldMust()
	edit.AddField("URL", "url", db.Text, form.Text).FieldMust()
	edit.AddField("Updated", "updated_at", db.Timestamptz, form.Default).
		FieldHideWhenUpdate().
		FieldDisableWhenCreate().
		FieldNowWhenUpdate()
	edit.AddField("Created by user", "created_by_user_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("users", "email", "id").
		FieldOptionsTableProcessFn(blankOption).
		FieldPostFilterFn(nullableValue)
	edit.AddField("External ID", "external_id", db.Text, form.Text).
		FieldPostFilterFn(nullableValue)
	edit.SetTable("problems").
		SetTitle("Problems").
		SetDescription("Create and edit problem metadata").
		SetPostValidator(func(values formValues.Values) error {
			return validateProblemForm(values)
		})

	return problemTable{problems}
}

func validateProblemForm(values formValues.Values) error {
	if strings.TrimSpace(values.Get("title")) == "" || strings.TrimSpace(values.Get("url")) == "" {
		return errors.New("title and URL must not be empty")
	}
	if strings.TrimSpace(values.Get("difficulty")) == "" {
		return errors.New(difficultyRequiredError)
	}
	if strings.TrimSpace(values.Get("source_type")) == "" {
		return errors.New(sourceRequiredError)
	}
	if strings.TrimSpace(values.Get("platform_id")) == "" {
		return errors.New(platformRequiredError)
	}
	if strings.TrimSpace(values.Get("external_slug")) == "" {
		return errors.New(externalSlugRequiredError)
	}
	return nil
}
