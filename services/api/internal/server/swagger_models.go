package server

import "github.com/mxdtrip/realgo/services/api/internal/auth"

// UserData documents a map-shaped HTTP payload.
//
// swagger:model UserData
type UserData struct {
	// Required: true
	User userResponse `json:"user"`
}

// TokensData documents a map-shaped HTTP payload.
//
// swagger:model TokensData
type TokensData struct {
	// Required: true
	Tokens auth.TokenPair `json:"tokens"`
}

// RegistrationPending documents a map-shaped HTTP payload.
//
// swagger:model RegistrationPending
type RegistrationPending struct {
	// Required: true
	// Enum: ["verification_requested"]
	Status string `json:"status"`
	// Required: true
	Challenge string `json:"challenge"`
}

// ExportAcknowledged documents a map-shaped HTTP payload.
//
// swagger:model ExportAcknowledged
type ExportAcknowledged struct {
	// Required: true
	// Enum: ["accepted"]
	Status string `json:"status"`
	// Required: true
	Message string `json:"message"`
}
