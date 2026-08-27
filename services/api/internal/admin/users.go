package admin

import (
	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
)

// Users exposes application users as a read-only admin table.
func Users(ctx *context.Context) table.Table {
	cfg := table.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey("id", db.Bigint).
		SetCanAdd(false).
		SetEditable(false).
		SetDeletable(false)

	users := table.NewDefaultTable(ctx, cfg)
	info := users.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Email", "email", db.Text)
	info.AddField("Plan", "plan", db.Varchar)
	info.AddField("Timezone", "timezone", db.Varchar)
	info.AddField("Platform", "platform", db.Varchar)
	info.AddField("Grade", "grade", db.Varchar)
	info.AddField("Prep goal", "prep_goal", db.Varchar)
	info.AddField("Target company", "target_company", db.Text)
	info.AddField("Target position", "target_position", db.Text)
	info.AddField("Interview", "interview_date", db.Timestamp).FieldSortable()
	info.AddField("Onboarded", "onboarding_completed_at", db.Timestamp).FieldSortable()
	info.AddField("Demo", "is_demo", db.Boolean).FieldFilterable()
	info.AddField("Created", "created_at", db.Timestamp).FieldSortable()
	addILikeFilters(info,
		ilikeFilter{"Email", "users", "email"},
		ilikeFilter{"Plan", "users", "plan"},
		ilikeFilter{"Platform", "users", "platform"},
		ilikeFilter{"Grade", "users", "grade"},
	)
	info.SetTable("users").
		SetTitle("Users").
		SetDescription("Application users").
		HideNewButton().
		HideEditButton().
		HideDeleteButton()

	return users
}
