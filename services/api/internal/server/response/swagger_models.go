package response

// ErrorEnvelope documents a map-shaped HTTP payload.
//
// swagger:model ErrorEnvelope
type ErrorEnvelope struct {
	// Required: true
	Error Error `json:"error"`
	// Required: false
	Meta *Meta `json:"meta"`
}
