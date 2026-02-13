package models

// Friend represents another user added as a friend, as defined in data-models.md.
// Stored in users/{userID}/friends. ID is Firestore document ID and is not sent over the API.
type Friend struct {
	// ID is the Firestore document ID. Not sent in API.
	ID string `firestore:"-" json:"-"`

	// ShareToken is the friend user's ShareToken.
	ShareToken string `firestore:"ShareToken" json:"shareToken"`

	// Name is the friend user's name; duplicated for faster access.
	Name string `firestore:"Name" json:"name"`

	// ImageURL is the friend user's image URL; duplicated for faster access, set when the friend is created.
	ImageURL string `firestore:"ImageURL" json:"imageUrl"`
}

// LoginResponse is the response body for POST /login (includes friends list).
type LoginResponse struct {
	Friends []Friend `json:"friends"`
}
