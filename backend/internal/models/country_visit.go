package models

import (
	"time"
)

// CountryVisit represents a visit to a country by a user, as defined in data-models.md.
// Firestore ID is stored in ID but must not be sent over the REST interface.
type CountryVisit struct {
	// CountryCode is a 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
	CountryCode string `firestore:"country_code" json:"countryCode"`

	// VisitedTime is the time of the visit. Optional.
	VisitedTime *time.Time `firestore:"visited_time" json:"visitedTime,omitempty"`

	// UserID is the ID of the user who created this object.
	UserID string `firestore:"user_id" json:"userId"`

	// ID is the Firestore document ID. Exposed in API for DELETE /visits/:id (see api.md).
	ID string `firestore:"-" json:"id"`
}

// CountryVisitResponse is the response wrapper for GET /visits.
type CountryVisitResponse struct {
	Visits []CountryVisit `json:"visits"`
}
