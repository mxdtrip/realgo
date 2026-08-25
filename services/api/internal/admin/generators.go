package admin

import "github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"

// Generators contains application tables exposed in GoAdmin.
var Generators = table.GeneratorList{
	"problem_reports": ProblemReports,
	"problems":        Problems,
	"users":           Users,
}
