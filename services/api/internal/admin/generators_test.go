package admin

import (
	"testing"

	"github.com/GoAdminGroup/go-admin/modules/db"
	formValues "github.com/GoAdminGroup/go-admin/plugins/admin/modules/form"
)

func TestGeneratorPermissions(t *testing.T) {
	crud := []string{
		"cards", "companies", "company_problems", "pattern_family_subpatterns",
		"pattern_learning_materials", "patterns", "platforms", "problem_subpatterns",
		"problems", "quiz_questions", "roadmap_items", "subpattern_companies",
		"subpattern_prerequisites", "taxonomy_versions",
	}
	readOnly := []string{
		"ai_request_logs", "extension_events", "problem_reports", "quiz_answers",
		"review_attempts", "review_schedules", "user_practice_patterns",
		"user_problem_progress", "user_roadmap_configs", "user_roadmap_plan_items", "users",
	}

	if got, want := len(Generators), len(crud)+len(readOnly); got != want {
		t.Fatalf("Generators has %d entries, want %d", got, want)
	}
	for _, name := range crud {
		generator, ok := Generators[name]
		if !ok {
			t.Errorf("missing CRUD generator %q", name)
			continue
		}
		table := generator(nil)
		if !table.GetCanAdd() || !table.GetEditable() || !table.GetDeletable() {
			t.Errorf("%s permissions = add:%v edit:%v delete:%v, want CRUD", name, table.GetCanAdd(), table.GetEditable(), table.GetDeletable())
		}
	}
	for _, name := range readOnly {
		generator, ok := Generators[name]
		if !ok {
			t.Errorf("missing read-only generator %q", name)
			continue
		}
		table := generator(nil)
		if table.GetCanAdd() || table.GetEditable() || table.GetDeletable() {
			t.Errorf("%s permissions = add:%v edit:%v delete:%v, want read-only", name, table.GetCanAdd(), table.GetEditable(), table.GetDeletable())
		}
	}
}

func TestLearningMaterialKeepsPrimaryKeyOnEdit(t *testing.T) {
	fields := PatternLearningMaterials(nil).GetForm().FieldsWithValue(
		"pattern_id", "160", nil, map[string]interface{}{}, func() *db.SQL { return nil },
	)
	field := fields.FindByFieldName("pattern_id")
	if field == nil || !field.Hide || string(field.Value) != "160" {
		t.Fatal("pattern_id must be submitted as a hidden field on edit")
	}
}

func TestValidateCard(t *testing.T) {
	valid := formValues.Values{"question": {"Q"}, "answer": {"A"}, "problem_id": {"1"}}
	if err := validateCard(valid); err != nil {
		t.Fatalf("valid card: %v", err)
	}
	invalid := formValues.Values{"question": {"Q"}, "answer": {"A"}, "problem_id": {"1"}, "pattern_id": {"2"}}
	if err := validateCard(invalid); err == nil {
		t.Fatal("card with two targets passed validation")
	}
}

func TestValidateQuizQuestion(t *testing.T) {
	valid := formValues.Values{
		"question": {"Q"}, "problem_id": {"1"},
		"options": {`["a","b"]`}, "correct_option": {"1"},
	}
	if err := validateQuizQuestion(valid); err != nil {
		t.Fatalf("valid quiz question: %v", err)
	}
	invalid := formValues.Values{
		"question": {"Q"}, "problem_id": {"1"},
		"options": {`["a"]`}, "correct_option": {"1"},
	}
	if err := validateQuizQuestion(invalid); err == nil {
		t.Fatal("out-of-range correct option passed validation")
	}
}
