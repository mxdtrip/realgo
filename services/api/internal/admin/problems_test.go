package admin

import (
	"errors"
	"testing"

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
