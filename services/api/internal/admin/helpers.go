package admin

import (
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	adminTable "github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/lib/pq"
)

type listField struct {
	title      string
	name       string
	typeName   db.DatabaseType
	filterable bool
	sortable   bool
}

func readOnlyTable(ctx *context.Context, tableName, title, description, primaryKey string, primaryType db.DatabaseType, fields ...listField) adminTable.Table {
	cfg := adminTable.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey(primaryKey, primaryType).
		SetCanAdd(false).
		SetEditable(false).
		SetDeletable(false)
	t := adminTable.NewDefaultTable(ctx, cfg)
	info := t.GetInfo()
	for _, field := range fields {
		f := info.AddField(field.title, field.name, field.typeName)
		if field.filterable {
			f.FieldFilterable()
		}
		if field.sortable {
			f.FieldSortable()
		}
	}
	info.SetTable(tableName).
		SetTitle(title).
		SetDescription(description).
		HideNewButton().
		HideEditButton().
		HideDeleteButton()
	return t
}

func blankOption(options types.FieldOptions) types.FieldOptions {
	return append(types.FieldOptions{{Text: "None", Value: ""}}, options...)
}

func nullableValue(value types.PostFieldModel) interface{} {
	if strings.TrimSpace(value.Value.Value()) == "" {
		return nil
	}
	return value.Value.Value()
}

func postgresTextArray(value types.PostFieldModel) interface{} {
	return pq.Array([]string(value.Value))
}

func option(text, value string) types.FieldOption {
	return types.FieldOption{Text: text, Value: value}
}

func patternKind(kind string) types.OptionTableQueryProcessFn {
	return func(query *db.SQL) *db.SQL {
		return query.Where("kind", "=", kind)
	}
}
