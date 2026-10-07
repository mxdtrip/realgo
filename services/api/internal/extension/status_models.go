package extension

import "time"

// StatusResponse is the GET /api/v1/me/extension/status payload.
// StatusResponse documents the ExtensionStatusResponse JSON shape.
//
// swagger:model ExtensionStatusResponse
type StatusResponse struct {
	// Required: true
	Connected bool `json:"connected"`
	// Required: true
	// Extensions:
	// ---
	// x-nullable: true
	// ---
	Platforms []PlatformStatus `json:"platforms"`
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
	// Required: true
	Source string `json:"source"`
	// Required: true
	Status string `json:"status"`
	// swagger:name lastSyncAt
	// Required: true
	// swagger:strfmt date-time
	LastSyncAt time.Time `json:"lastSyncAt"`
}

// RecentEvent is one extension activity-feed item.
// RecentEvent documents the ExtensionRecentEvent JSON shape.
//
// swagger:model ExtensionRecentEvent
type RecentEvent struct {
	// Required: true
	ID string `json:"id"`
	// Required: true
	Source string `json:"source"`
	// Required: true
	Event string `json:"event"`
	// Required: true
	Title string `json:"title"`
	// swagger:name occurredAt
	// Required: true
	// swagger:strfmt date-time
	OccurredAt time.Time `json:"occurredAt"`
}
