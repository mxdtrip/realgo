package admin

import (
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/parameter"
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

type ilikeFilter struct {
	label  string
	table  string
	column string
}

func (f ilikeFilter) parameter() string {
	return f.table + "_" + f.column + "_search"
}

func addILikeFilters(info *types.InfoPanel, filters ...ilikeFilter) {
	for _, filter := range filters {
		info.AddFilter(filter.label, filter.parameter(), db.Text, func(params *parameter.Parameters) {
			value := strings.TrimSpace(params.GetFieldValue(filter.parameter()))
			if value == "" {
				return
			}

			raw := pq.QuoteIdentifier(filter.table) + "." + pq.QuoteIdentifier(filter.column) + " ILIKE ?"
			if info.WhereRaws.Raw != "" {
				raw = "(" + info.WhereRaws.Raw + ") AND " + raw
			}
			args := append(append([]interface{}{}, info.WhereRaws.Args...), "%"+value+"%")
			info.WhereRaw(raw, args...)
		})
	}
}

func readOnlyTable(ctx *context.Context, tableName, title, description, primaryKey string, primaryType db.DatabaseType, fields ...listField) adminTable.Table {
	cfg := adminTable.DefaultConfigWithDriver(db.DriverPostgresql).
		SetPrimaryKey(primaryKey, primaryType).
		SetCanAdd(false).
		SetEditable(false).
		SetDeletable(false)
	t := adminTable.NewDefaultTable(ctx, cfg)
	info := t.GetInfo()
	textFilters := make([]ilikeFilter, 0)
	for _, field := range fields {
		f := info.AddField(field.title, field.name, field.typeName)
		if field.filterable {
			switch field.typeName {
			case db.Text, db.Varchar, db.Char:
				textFilters = append(textFilters, ilikeFilter{field.title, tableName, field.name})
			default:
				f.FieldFilterable()
			}
		}
		if field.sortable {
			f.FieldSortable()
		}
	}
	addILikeFilters(info, textFilters...)
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
