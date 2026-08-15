package admin

import "github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"

// Generators contains application tables exposed in GoAdmin.
var Generators = table.GeneratorList{
	"problems": Problems,
	"users":    Users,
}
