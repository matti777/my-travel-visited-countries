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

	// ImageURL is the user's profile image URL from the token; stored at login.
	ImageURL string `firestore:"ImageURL" json:"-"`

	// Settings is optional on older documents; nil means apply DefaultUserSettings().
	Settings *UserSettings `firestore:"Settings" json:"-"`
}

// UserSettings holds per-user preferences (see data-models.md).
type UserSettings struct {
	HomeCountryCode string          `firestore:"HomeCountryCode,omitempty" json:"homeCountryCode,omitempty"`
	Description     string          `firestore:"Description,omitempty" json:"description,omitempty"`
	Sharing         SharingSettings `firestore:"Sharing" json:"sharing"`
}

// SharingSettings controls what is exposed on shared visit lists.
type SharingSettings struct {
	ShareMediaURL bool `firestore:"ShareMediaURL" json:"shareMediaUrl"`
	ShareNotes    bool `firestore:"ShareNotes" json:"shareNotes"`
	ShareTags     bool `firestore:"ShareTags" json:"shareTags"`
}

// DefaultUserSettings returns sharing defaults when Settings is absent (all true).
func DefaultUserSettings() UserSettings {
	return UserSettings{
		Sharing: SharingSettings{
			ShareMediaURL: true,
			ShareNotes:    true,
			ShareTags:     true,
		},
	}
}

// EffectiveSettings returns stored Settings or defaults when Settings is nil.
func (u *User) EffectiveSettings() UserSettings {
	if u == nil || u.Settings == nil {
		return DefaultUserSettings()
	}
	return *u.Settings
}

// SettingsResponse is the JSON body for GET/PUT /settings (omits unset optionals).
func SettingsToResponse(s UserSettings) map[string]interface{} {
	out := map[string]interface{}{
		"sharing": map[string]bool{
			"shareMediaUrl": s.Sharing.ShareMediaURL,
			"shareNotes":    s.Sharing.ShareNotes,
			"shareTags":     s.Sharing.ShareTags,
		},
	}
	if s.HomeCountryCode != "" {
		out["homeCountryCode"] = s.HomeCountryCode
	}
	if s.Description != "" {
		out["description"] = s.Description
	}
	return out
}
