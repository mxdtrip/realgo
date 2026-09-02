package admin

import (
	"testing"

	"github.com/GoAdminGroup/go-admin/template/types"
)

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
