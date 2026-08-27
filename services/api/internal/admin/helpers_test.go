package admin

import (
	"reflect"
	"testing"

	"github.com/GoAdminGroup/go-admin/modules/db"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/parameter"
	"github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"
)

func TestAddILikeFilters(t *testing.T) {
	info := table.NewDefaultTable(nil, table.DefaultConfigWithDriver(db.DriverPostgresql)).GetInfo()
	filters := []ilikeFilter{
		{"Title", "problems", "title"},
		{"Platform", "platforms", "name"},
	}
	addILikeFilters(info, filters...)

	params := parameter.BaseParam().
		AddField(filters[0].parameter(), " ZigZag ").
		AddField(filters[1].parameter(), "LEET")
	for _, update := range info.UpdateParametersFns {
		update(&params)
	}

	wantRaw := `("problems"."title" ILIKE ?) AND "platforms"."name" ILIKE ?`
	if info.WhereRaws.Raw != wantRaw {
		t.Fatalf("WhereRaw = %q, want %q", info.WhereRaws.Raw, wantRaw)
	}
	wantArgs := []interface{}{"%ZigZag%", "%LEET%"}
	if !reflect.DeepEqual(info.WhereRaws.Args, wantArgs) {
		t.Fatalf("WhereRaw args = %#v, want %#v", info.WhereRaws.Args, wantArgs)
	}
}
