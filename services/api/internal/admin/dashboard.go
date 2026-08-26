package admin

import (
	"html/template"

	"github.com/GoAdminGroup/go-admin/context"
	"github.com/GoAdminGroup/go-admin/template/types"
)

// Dashboard is the admin panel landing page.
func Dashboard(_ *context.Context) (types.Panel, error) {
	return types.Panel{
		Title:       "Dashboard",
		Description: "Administration",
		Content: template.HTML(`<p>
			<a class="btn btn-primary" href="/admin/info/problems">Problems</a>
			<a class="btn btn-default" href="/admin/info/cards">Cards</a>
			<a class="btn btn-default" href="/admin/info/companies">Companies</a>
			<a class="btn btn-default" href="/admin/info/users">Users</a>
			<a class="btn btn-default" href="/admin/info/problem_reports">Problem reports</a>
		</p>`),
	}, nil
}
