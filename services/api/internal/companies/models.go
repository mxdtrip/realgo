package companies

// Company documents the CompaniesCompany JSON shape.
//
// swagger:model CompaniesCompany
type Company struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID string `json:"id"`
	// Name is the name JSON field.
	//
	// Required: true
	Name string `json:"name"`
	// Source is the source JSON field.
	//
	// Required: true
	Source string `json:"source"`
}
