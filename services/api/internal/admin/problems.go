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

// Problems exposes problem metadata without allowing records to be created or deleted.
func Problems(ctx *context.Context) table.Table {
	cfg := table.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey("id", db.Bigint).
		SetCanAdd(false).
		SetDeletable(false)

	problems := table.NewDefaultTable(ctx, cfg)
	info := problems.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Title", "title", db.Text).FieldFilterable()
	info.AddField("Platform", "name", db.Varchar).FieldJoin(types.Join{
		Field:     "platform_id",
		JoinField: "id",
		Table:     "platforms",
	}).FieldFilterable()
	info.AddField("External slug", "external_slug", db.Text).FieldFilterable()
	info.AddField("Difficulty", "difficulty", db.Varchar).FieldFilterable()
	info.AddField("Source", "source_type", db.Varchar).FieldFilterable()
	info.AddField("URL", "url", db.Text)
	info.AddField("Updated", "updated_at", db.Timestamp).FieldSortable()
	info.SetTable("problems").
		SetTitle("Problems").
		SetDescription("Problem catalog").
		HideNewButton().
		HideDeleteButton()

	edit := problems.GetForm()
	edit.AddField("ID", "id", db.Bigint, form.Default).
		FieldDisplayButCanNotEditWhenUpdate().
		FieldDisableWhenCreate()
	edit.AddField("Title", "title", db.Text, form.Text).FieldMust()
	edit.AddField("Difficulty", "difficulty", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{
			{Text: "Easy", Value: "easy"},
			{Text: "Medium", Value: "medium"},
			{Text: "Hard", Value: "hard"},
		})
	edit.AddField("URL", "url", db.Text, form.Text).FieldMust()
	edit.AddField("Updated", "updated_at", db.Timestamptz, form.Default).
		FieldHideWhenUpdate().
		FieldNowWhenUpdate()
	edit.SetTable("problems").
		SetTitle("Problems").
		SetDescription("Edit problem metadata").
		SetPostValidator(func(values formValues.Values) error {
			if strings.TrimSpace(values.Get("title")) == "" || strings.TrimSpace(values.Get("url")) == "" {
				return errors.New("title and URL must not be empty")
			}
			return nil
		})

	return problems
}
