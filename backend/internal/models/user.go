package models

// User represents a system user. Data parsed from incoming authentication token.
// Only used in the backend. Aligns with data-models.md.
type User struct {
	// ID is the user ID from the token (Firebase sub). Used as Firestore document ID.
	ID string `firestore:"-" json:"-"`

	// Name is the user name from the token.
	Name string `firestore:"name" json:"-"`

	// Email is the user email from the token.
	Email string `firestore:"email" json:"-"`
}
