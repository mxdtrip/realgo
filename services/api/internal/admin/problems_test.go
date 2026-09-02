package admin

import (
	"errors"
	"testing"

	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
	"github.com/GoAdminGroup/go-admin/template/types"
	"github.com/lib/pq"
)

func TestProblemFormError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "problem platform slug conflict",
			err:  &pq.Error{Code: "23505", Constraint: "problems_platform_id_external_slug_key"},
			want: duplicateProblemSlugError,
		},
		{
			name: "another unique constraint",
			err:  &pq.Error{Code: "23505", Constraint: "users_email_key"},
			want: "pq: ",
		},
		{
			name: "difficulty constraint",
			err:  &pq.Error{Code: "23514", Constraint: "problems_difficulty_check"},
			want: difficultyRequiredError,
		},
		{
			name: "source constraint",
			err:  &pq.Error{Code: "23514", Constraint: "problems_source_type_check"},
			want: sourceRequiredError,
		},
		{name: "ordinary error", err: errors.New("database unavailable"), want: "database unavailable"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := problemFormError(tt.err)
			if got == nil || got.Error() != tt.want {
				t.Fatalf("problemFormError() = %v, want %q", got, tt.want)
			}
		})
	}
}

func TestProblemDifficultyIsRequired(t *testing.T) {
	difficulty := Problems(nil).GetForm().FieldList.FindByFieldName("difficulty")
	if difficulty == nil || !difficulty.Must || len(difficulty.Options) == 0 || difficulty.Options[0].Value != "" {
		t.Fatal("difficulty must be a required select with an empty prompt")
	}

	values := formValues.Values{
		"title":         {"Two Sum"},
		"url":           {"https://example.com/two-sum"},
		"platform_id":   {"1"},
		"external_slug": {"two-sum"},
		"source_type":   {"manual"},
	}
	if err := validateProblemForm(values); err == nil || err.Error() != difficultyRequiredError {
		t.Fatalf("validateProblemForm() error = %v, want %q", err, difficultyRequiredError)
	}
	values["difficulty"] = []string{"medium"}
	if err := validateProblemForm(values); err != nil {
		t.Fatalf("validateProblemForm() error = %v", err)
	}
}

func TestProblemSourceAndNewForm(t *testing.T) {
	problems := Problems(nil)
	if !problems.GetCanAdd() {
		t.Fatal("problem form must allow creating records")
	}

	form := problems.GetForm()
	for _, fieldName := range []string{"platform_id", "external_slug", "source_type"} {
		field := form.FieldList.FindByFieldName(fieldName)
		if field == nil || !field.Must {
			t.Fatalf("%s must be required", fieldName)
		}
	}

	values := formValues.Values{
		"title":         {"Two Sum"},
		"url":           {"https://example.com/two-sum"},
		"platform_id":   {"1"},
		"external_slug": {"two-sum"},
		"difficulty":    {"medium"},
	}
	if err := validateProblemForm(values); err == nil || err.Error() != sourceRequiredError {
		t.Fatalf("validateProblemForm() error = %v, want %q", err, sourceRequiredError)
	}

	for _, source := range []string{"roadmap", "manual", "extension", "ai", "dataset"} {
		values["source_type"] = []string{source}
		if err := validateProblemForm(values); err != nil {
			t.Fatalf("validateProblemForm(%q) error = %v", source, err)
		}
	}
}

func TestProblemEditRefreshesUpdatedAt(t *testing.T) {
	updatedAt := Problems(nil).GetForm().FieldList.FindByFieldName("updated_at")
	if updatedAt == nil || !updatedAt.EditHide || updatedAt.PostFilterFn == nil {
		t.Fatal("updated_at must be submitted as a hidden, auto-refreshed edit field")
	}

	const old = "2026-08-25 19:02:08"
	got := updatedAt.PostFilterFn(types.PostFieldModel{
		Value:    types.FieldModelValue{old},
		PostType: types.PostTypeUpdate,
	})
	if got == old {
		t.Fatal("updated_at was not refreshed")
	}
}
