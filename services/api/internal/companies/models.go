package companies

// Company documents the CompaniesCompany JSON shape.
//
// swagger:model CompaniesCompany
type Company struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Name string `json:"name"`
	// Required: true
	Source string `json:"source"`
}
