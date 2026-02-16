package logging

// Structured log parameter names for GCP Cloud Logging (jsonPayload.*).
// Use these constants so logs are searchable by field name.
const (
	CurrentUserID = "current_user_id"
	UserID        = "user_id"
	VisitID       = "visit_id"
	Error       = "error"
	Port        = "port"
	Count       = "count"
	CountryCode = "country_code"
)
