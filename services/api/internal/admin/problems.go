package admin

import (
	"errors"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/GoAdminGroup/go-admin/template/types/form"
)

// Problems exposes the problem catalog with protected CRUD.
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
	})
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
		FieldMust()
	edit.AddField("External slug", "external_slug", db.Text, form.Text).FieldMust()
	edit.AddField("Title", "title", db.Text, form.Text).FieldMust()
	edit.AddField("Difficulty", "difficulty", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{
			{Text: "Easy", Value: "easy"},
			{Text: "Medium", Value: "medium"},
			{Text: "Hard", Value: "hard"},
		})
	edit.AddField("URL", "url", db.Text, form.Text).FieldMust()
	edit.AddField("Source", "source_type", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{
			option("Roadmap", "roadmap"), option("Manual", "manual"),
			option("Extension", "extension"), option("AI", "ai"), option("Dataset", "dataset"),
		})
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
			if strings.TrimSpace(values.Get("external_slug")) == "" || strings.TrimSpace(values.Get("title")) == "" || strings.TrimSpace(values.Get("url")) == "" {
				return errors.New("external slug, title and URL must not be empty")
			}
			return nil
		})

	return problems
}
