package extension

import "time"

// StatusResponse is the GET /api/v1/me/extension/status payload.
// StatusResponse documents the ExtensionStatusResponse JSON shape.
//
// swagger:model ExtensionStatusResponse
type StatusResponse struct {
	// Connected is the connected JSON field.
	//
	// Required: true
	Connected bool `json:"connected"`
	// Platforms is the platforms JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Platforms []PlatformStatus `json:"platforms"`
	// RecentEvents is the recentEvents JSON field.
	//
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	RecentEvents []RecentEvent `json:"recentEvents"`
}

// PlatformStatus summarizes the latest sync activity for one source.
// PlatformStatus documents the ExtensionPlatformStatus JSON shape.
//
// swagger:model ExtensionPlatformStatus
type PlatformStatus struct {
	// Source is the source JSON field.
	//
	// Required: true
	Source string `json:"source"`
	// Status is the status JSON field.
	//
	// Required: true
	Status string `json:"status"`
	// swagger:name lastSyncAt
	// LastSyncAt is the lastSyncAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	LastSyncAt time.Time `json:"lastSyncAt"`
}

// RecentEvent is one extension activity-feed item.
// RecentEvent documents the ExtensionRecentEvent JSON shape.
//
// swagger:model ExtensionRecentEvent
type RecentEvent struct {
	// ID is the id JSON field.
	//
	// Required: true
	ID string `json:"id"`
	// Source is the source JSON field.
	//
	// Required: true
	Source string `json:"source"`
	// Event is the event JSON field.
	//
	// Required: true
	Event string `json:"event"`
	// Title is the title JSON field.
	//
	// Required: true
	Title string `json:"title"`
	// swagger:name occurredAt
	// OccurredAt is the occurredAt JSON field.
	//
	// Required: true
	// swagger:strfmt date-time
	OccurredAt time.Time `json:"occurredAt"`
}
