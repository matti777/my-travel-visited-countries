package models

// User represents a system user. Data parsed from incoming authentication token.
// Only used in the backend. Aligns with data-models.md.
type User struct {
	// ID is the Firestore document ID, set from auth token UserID for faster access (no DB fetch for subcollections). Not sent in API.
	ID string `firestore:"-" json:"-"`

	// UserID is the user ID from the auth token (Firebase sub). Same as ID when doc ID is auth UserID.
	UserID string `firestore:"-" json:"-"`

	// ShareToken is a random UUID generated at user creation.
	ShareToken string `firestore:"ShareToken" json:"-"`

	// Name is the user name from the token.
	Name string `firestore:"Name" json:"-"`

	// Email is the user email from the token.
	Email string `firestore:"Email" json:"-"`
}
