package admin

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/GoAdminGroup/go-admin/template/types/form"
)

func TaxonomyVersions(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("code", db.Text))
	info := t.GetInfo()
	info.AddField("Code", "code", db.Text).FieldFilterable()
	info.AddField("Title", "title", db.Text).FieldFilterable()
	info.AddField("Created", "created_at", db.Timestamp).FieldSortable()
	info.SetTable("taxonomy_versions").SetTitle("Taxonomy versions").SetDescription("Pattern taxonomy releases")
	f := t.GetForm()
	f.AddField("Code", "code", db.Text, form.Text).FieldDisplayButCanNotEditWhenUpdate().FieldMust()
	f.AddField("Title", "title", db.Text, form.Text).FieldMust()
	f.AddField("Created", "created_at", db.Timestamp, form.Default).FieldNotAllowEdit().FieldDisableWhenCreate()
	f.SetTable("taxonomy_versions").SetTitle("Taxonomy versions").SetDescription("Create and edit taxonomy releases").
		SetPostValidator(required("code", "title"))
	return t
}

func Patterns(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("id", db.Bigint))
	info := t.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Code", "code", db.Varchar).FieldFilterable()
	info.AddField("Name", "name", db.Varchar).FieldFilterable()
	info.AddField("Kind", "kind", db.Varchar).FieldFilterable()
	info.AddField("Taxonomy", "taxonomy_version", db.Text).FieldFilterable()
	info.AddField("Position", "position", db.Int).FieldSortable()
	info.AddField("Description", "description", db.Text)
	info.SetTable("patterns").SetTitle("Patterns").SetDescription("Pattern taxonomy nodes")
	f := t.GetForm()
	f.AddField("ID", "id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
	f.AddField("Code", "code", db.Varchar, form.Text).FieldMust()
	f.AddField("Name", "name", db.Varchar, form.Text).FieldMust()
	f.AddField("Description", "description", db.Text, form.TextArea).FieldPostFilterFn(nullableValue)
	f.AddField("Parent", "parent_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("patterns", "name", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Kind", "kind", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{option("Pattern", "pattern"), option("Tool", "tool"), option("Family", "family"), option("Subpattern", "subpattern")}).FieldMust()
	f.AddField("Taxonomy", "taxonomy_version", db.Text, form.SelectSingle).
		FieldOptionsFromTable("taxonomy_versions", "title", "code").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Position", "position", db.Int, form.Number).FieldPostFilterFn(nullableValue)
	f.AddField("Techniques", "techniques", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.AddField("Recognition symptoms", "recognition_symptoms", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.AddField("Checklist", "checklist", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.SetTable("patterns").SetTitle("Patterns").SetDescription("Create and edit taxonomy nodes").
		SetPostValidator(required("code", "name", "kind"))
	return t
}

func PatternLearningMaterials(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("pattern_id", db.Bigint))
	info := t.GetInfo()
	info.AddField("Pattern", "pattern_id", db.Bigint).FieldFilterable()
	info.AddField("What it is", "what_it_is", db.Text)
	info.AddField("Mental model", "mental_model", db.Text)
	info.AddField("Core invariant", "core_invariant", db.Text)
	info.AddField("Updated", "updated_at", db.Timestamp).FieldSortable()
	info.SetTable("pattern_learning_materials").SetTitle("Learning materials").SetDescription("Pattern methodology content")
	f := t.GetForm()
	f.AddField("Pattern", "pattern_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("patterns", "name", "id").FieldDisableWhenUpdate().FieldMust()
	f.AddField("What it is", "what_it_is", db.Text, form.TextArea).FieldMust()
	f.AddField("Mental model", "mental_model", db.Text, form.TextArea)
	f.AddField("Recognition cues", "recognition_cues", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.AddField("Anti cues", "anti_cues", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.AddField("Core invariant", "core_invariant", db.Text, form.TextArea)
	f.AddField("Canonical skeleton", "canonical_skeleton", db.Text, form.Code)
	f.AddField("Mini example", "mini_example", db.Text, form.Code)
	f.AddField("Common mistakes", "common_mistakes", db.Text, form.Array).FieldPostFilterFn(postgresTextArray)
	f.AddField("Don't confuse with", "dont_confuse_with", db.JSON, form.Code).FieldMust()
	f.AddField("Updated", "updated_at", db.Timestamp, form.Datetime).FieldNowWhenInsert().FieldNowWhenUpdate()
	f.SetTable("pattern_learning_materials").SetTitle("Learning materials").SetDescription("Create and edit pattern content").
		SetPostValidator(validateLearningMaterial)
	return t
}

func validateLearningMaterial(values formValues.Values) error {
	if strings.TrimSpace(values.Get("what_it_is")) == "" {
		return errors.New("what_it_is must not be empty")
	}
	if !json.Valid([]byte(values.Get("dont_confuse_with"))) {
		return errors.New("dont_confuse_with must be valid JSON")
	}
	return nil
}

func Companies(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("id", db.Bigint))
	info := t.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Code", "code", db.Text).FieldFilterable()
	info.AddField("Name", "name", db.Text).FieldFilterable()
	info.SetTable("companies").SetTitle("Companies").SetDescription("Company catalog")
	f := t.GetForm()
	f.AddField("ID", "id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
	f.AddField("Code", "code", db.Text, form.Text).FieldMust()
	f.AddField("Name", "name", db.Text, form.Text).FieldMust()
	f.SetTable("companies").SetTitle("Companies").SetDescription("Create and edit companies").SetPostValidator(required("code", "name"))
	return t
}

func PatternFamilySubpatterns(ctx *context.Context) table.Table {
	t := relationTable(ctx, "pattern_family_subpatterns", "Family links", "Family to subpattern links")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Family", "family_id", db.Bigint).FieldFilterable()
	info.AddField("Subpattern", "subpattern_id", db.Bigint).FieldFilterable()
	info.AddField("Position", "position", db.Int).FieldSortable()
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Family", "family_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("family")).FieldMust()
	f.AddField("Subpattern", "subpattern_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("subpattern")).FieldMust()
	f.AddField("Position", "position", db.Int, form.Number).FieldMust()
	f.SetPostValidator(required("family_id", "subpattern_id", "position"))
	return t
}

func SubpatternPrerequisites(ctx *context.Context) table.Table {
	t := relationTable(ctx, "subpattern_prerequisites", "Prerequisites", "Subpattern prerequisite tools")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Subpattern", "subpattern_id", db.Bigint).FieldFilterable()
	info.AddField("Tool", "tool_id", db.Bigint).FieldFilterable()
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Subpattern", "subpattern_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("subpattern")).FieldMust()
	f.AddField("Tool", "tool_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("tool")).FieldMust()
	f.SetPostValidator(required("subpattern_id", "tool_id"))
	return t
}

func ProblemSubpatterns(ctx *context.Context) table.Table {
	t := relationTable(ctx, "problem_subpatterns", "Problem patterns", "Problem to subpattern links")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Problem", "problem_id", db.Bigint).FieldFilterable()
	info.AddField("Subpattern", "subpattern_id", db.Bigint).FieldFilterable()
	info.AddField("Tier", "tier", db.Varchar).FieldFilterable()
	info.AddField("Position", "position", db.Int).FieldSortable()
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Problem", "problem_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("problems", "title", "id").FieldMust()
	f.AddField("Subpattern", "subpattern_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("subpattern")).FieldMust()
	f.AddField("Tier", "tier", db.Varchar, form.SelectSingle).
		FieldOptions(types.FieldOptions{option("None", ""), option("Foundational", "foundational"), option("Core", "core"), option("Advanced", "advanced")}).
		FieldPostFilterFn(nullableValue)
	f.AddField("Position", "position", db.Int, form.Number).FieldPostFilterFn(nullableValue)
	f.SetPostValidator(required("problem_id", "subpattern_id"))
	return t
}

func SubpatternCompanies(ctx *context.Context) table.Table {
	t := relationTable(ctx, "subpattern_companies", "Company relevance", "Subpattern relevance by company")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Subpattern", "subpattern_id", db.Bigint).FieldFilterable()
	info.AddField("Company", "company_id", db.Bigint).FieldFilterable()
	info.AddField("Relevance", "relevance", db.Varchar).FieldFilterable()
	info.AddField("Confidence", "confidence", db.Varchar).FieldFilterable()
	info.AddField("Evidence", "evidence_count", db.Int).FieldSortable()
	info.AddField("Source", "source_type", db.Varchar).FieldFilterable()
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Subpattern", "subpattern_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("patterns", "name", "id", patternKind("subpattern")).FieldMust()
	f.AddField("Company", "company_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("companies", "name", "id").FieldMust()
	f.AddField("Relevance", "relevance", db.Varchar, form.SelectSingle).FieldOptions(relevanceOptions()).FieldMust()
	f.AddField("Confidence", "confidence", db.Varchar, form.SelectSingle).FieldOptions(levelOptions()).FieldMust()
	f.AddField("Evidence count", "evidence_count", db.Int, form.Number).FieldDefault("0").FieldMust()
	f.AddField("Last seen", "last_seen_at", db.Date, form.Date).FieldPostFilterFn(nullableValue)
	f.AddField("Source", "source_type", db.Varchar, form.SelectSingle).FieldOptions(sourceOptions()).FieldMust()
	f.SetPostValidator(required("subpattern_id", "company_id", "relevance", "confidence", "evidence_count", "source_type"))
	return t
}

func CompanyProblems(ctx *context.Context) table.Table {
	t := relationTable(ctx, "company_problems", "Company problems", "Company interview evidence")
	info := t.GetInfo()
	info.AddField("ID", "admin_id", db.Bigint).FieldSortable()
	info.AddField("Company", "company_id", db.Bigint).FieldFilterable()
	info.AddField("Problem", "problem_id", db.Bigint).FieldFilterable()
	info.AddField("Evidence", "evidence_count", db.Int).FieldSortable()
	info.AddField("Last seen", "last_seen_at", db.Date).FieldSortable()
	info.AddField("Source", "source_type", db.Varchar).FieldFilterable()
	f := t.GetForm()
	addAdminID(f)
	f.AddField("Company", "company_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("companies", "name", "id").FieldMust()
	f.AddField("Problem", "problem_id", db.Bigint, form.SelectSingle).FieldOptionsFromTable("problems", "title", "id").FieldMust()
	f.AddField("Evidence count", "evidence_count", db.Int, form.Number).FieldDefault("0").FieldMust()
	f.AddField("Last seen", "last_seen_at", db.Date, form.Date).FieldPostFilterFn(nullableValue)
	f.AddField("Source", "source_type", db.Varchar, form.SelectSingle).FieldOptions(sourceOptions()).FieldMust()
	f.SetPostValidator(required("company_id", "problem_id", "evidence_count", "source_type"))
	return t
}

func relationTable(ctx *context.Context, tableName, title, description string) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("admin_id", db.Bigint))
	t.GetInfo().SetTable(tableName).SetTitle(title).SetDescription(description)
	t.GetForm().SetTable(tableName).SetTitle(title).SetDescription(description)
	return t
}

func addAdminID(f *types.FormPanel) {
	f.AddField("ID", "admin_id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
}

func relevanceOptions() types.FieldOptions {
	return types.FieldOptions{option("High", "high"), option("Medium", "medium"), option("Low", "low"), option("Insufficient evidence", "insufficient_evidence"), option("No evidence", "no_evidence")}
}

func levelOptions() types.FieldOptions {
	return types.FieldOptions{option("High", "high"), option("Medium", "medium"), option("Low", "low")}
}

func sourceOptions() types.FieldOptions {
	return types.FieldOptions{option("Demo", "demo"), option("Manual", "manual"), option("Community", "community"), option("Dataset", "dataset")}
}
