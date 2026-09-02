package admin

import (
	"errors"
	"net/url"
	"strings"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/GoAdminGroup/go-admin/template/types/form"
)

func Platforms(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("id", db.Bigint))
	info := t.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("Code", "code", db.Varchar)
	info.AddField("Name", "name", db.Varchar)
	info.AddField("Base URL", "base_url", db.Text)
	addILikeFilters(info,
		ilikeFilter{"Code", "platforms", "code"},
		ilikeFilter{"Name", "platforms", "name"},
	)
	info.SetTable("platforms").SetTitle("Platforms").SetDescription("Problem platforms")

	f := t.GetForm()
	f.AddField("ID", "id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
	f.AddField("Code", "code", db.Varchar, form.Text).FieldMust()
	f.AddField("Name", "name", db.Varchar, form.Text).FieldMust()
	f.AddField("Base URL", "base_url", db.Text, form.Url)
	f.SetTable("platforms").SetTitle("Platforms").SetDescription("Create and edit platforms").
		SetPostValidator(validatePlatform)
	return t
}

func validatePlatform(values formValues.Values) error {
	if err := required("code", "name")(values); err != nil {
		return err
	}

	rawURL := strings.TrimSpace(values.Get("base_url"))
	if rawURL == "" {
		return nil
	}

	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("base_url must be an absolute HTTP(S) URL")
	}
	return nil
}

func Cards(ctx *context.Context) table.Table {
	t := table.NewDefaultTable(ctx, table.DefaultConfigWithDriver(db.DriverPostgresql).SetPrimaryKey("id", db.Bigint))
	info := t.GetInfo()
	info.AddField("ID", "id", db.Bigint).FieldSortable()
	info.AddField("User", "user_id", db.Bigint).FieldFilterable()
	info.AddField("Problem", "problem_id", db.Bigint).FieldFilterable()
	info.AddField("Pattern", "pattern_id", db.Bigint).FieldFilterable()
	info.AddField("Type", "type", db.Varchar)
	info.AddField("Question", "question", db.Text)
	info.AddField("Answer", "answer", db.Text)
	info.AddField("AI", "created_by_ai", db.Boolean).FieldFilterable()
	info.AddField("Source", "source", db.Text)
	info.AddField("Created", "created_at", db.Timestamp).FieldSortable()
	addILikeFilters(info,
		ilikeFilter{"Type", "cards", "type"},
		ilikeFilter{"Question", "cards", "question"},
		ilikeFilter{"Source", "cards", "source"},
	)
	info.SetTable("cards").SetTitle("Cards").SetDescription("Spaced-repetition cards")

	f := t.GetForm()
	f.AddField("ID", "id", db.Bigint, form.Default).FieldDisplayButCanNotEditWhenUpdate().FieldDisableWhenCreate()
	f.AddField("User", "user_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("users", "email", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Problem", "problem_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("problems", "title", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Pattern", "pattern_id", db.Bigint, form.SelectSingle).
		FieldOptionsFromTable("patterns", "name", "id").FieldOptionsTableProcessFn(blankOption).FieldPostFilterFn(nullableValue)
	f.AddField("Type", "type", db.Varchar, form.SelectSingle).FieldOptions(cardTypeOptions()).FieldMust()
	f.AddField("Question", "question", db.Text, form.TextArea).FieldMust()
	f.AddField("Answer", "answer", db.Text, form.TextArea).FieldMust()
	f.AddField("Explanation", "explanation", db.Text, form.TextArea).FieldPostFilterFn(nullableValue)
	f.AddField("Source", "source", db.Text, form.Text).FieldPostFilterFn(nullableValue)
	f.AddField("Created by AI", "created_by_ai", db.Boolean, form.SelectSingle).
		FieldOptions(types.FieldOptions{option("No", "false"), option("Yes", "true")}).FieldDefault("false")
	f.AddField("AI prompt version", "ai_prompt_version", db.Text, form.Text).FieldPostFilterFn(nullableValue)
	f.AddField("Created", "created_at", db.Timestamp, form.Default).FieldNotAllowEdit().FieldDisableWhenCreate()
	f.SetTable("cards").SetTitle("Cards").SetDescription("Create and edit cards").SetPostValidator(validateCard)
	return t
}

func validateCard(values formValues.Values) error {
	if strings.TrimSpace(values.Get("question")) == "" || strings.TrimSpace(values.Get("answer")) == "" {
		return errors.New("question and answer must not be empty")
	}
	if values.Get("problem_id") != "" && values.Get("pattern_id") != "" {
		return errors.New("choose a problem or a pattern, not both")
	}
	return nil
}

func required(names ...string) func(formValues.Values) error {
	return func(values formValues.Values) error {
		for _, name := range names {
			if strings.TrimSpace(values.Get(name)) == "" {
				return errors.New(name + " must not be empty")
			}
		}
		return nil
	}
}

func cardTypeOptions() types.FieldOptions {
	values := []string{"pattern_recognition", "algorithm_mechanics", "edge_case", "recognition", "invariant", "skeleton", "contrast", "pitfall", "debugging"}
	options := make(types.FieldOptions, 0, len(values))
	for _, value := range values {
		options = append(options, option(value, value))
	}
	return options
}
