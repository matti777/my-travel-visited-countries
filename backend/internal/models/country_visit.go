package models

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// MaxTagsPerVisit is the maximum number of tags allowed on a CountryVisit (see api.md).
const MaxTagsPerVisit = 10

var tagTokenPattern = regexp.MustCompile(`^[a-z]{2,}$`)

// CountryVisit represents a visit to a country by a user, as defined in data-models.md.
// Firestore ID is stored in ID but must not be sent over the REST interface.
type CountryVisit struct {
	// CountryCode is a 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
	CountryCode string `firestore:"CountryCode" json:"countryCode"`

	// VisitedTime is the time of the visit. Mandatory. Stored in Firestore as VisitTime.
	VisitedTime time.Time `firestore:"VisitTime" json:"visitedTime"`

	// MediaURL is an optional well-formed URL for a hyperlink (e.g. picture collection or video). Stored in Firestore as MediaURL.
	MediaURL *string `firestore:"MediaURL" json:"mediaUrl,omitempty"`

	// Tags are optional lowercase [a-z] strings (min length 2); stored in Firestore as Tags.
	Tags []string `firestore:"Tags" json:"tags"`

	// UserID is the ID of the user who created this object. Set when loading; not stored in Firestore (user implied by path).
	UserID string `firestore:"-" json:"userId"`

	// ID is the Firestore document ID. Exposed in API for DELETE /visits/:id (see api.md).
	ID string `firestore:"-" json:"id"`
}

// ValidateMediaURL returns true if urlStr is empty or a well-formed URL usable as a hyperlink (http/https, non-empty host).
func ValidateMediaURL(urlStr string) bool {
	urlStr = strings.TrimSpace(urlStr)
	if urlStr == "" {
		return true
	}
	u, err := url.Parse(urlStr)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}
	if u.Host == "" {
		return false
	}
	return true
}

// DedupeTagsPreserveOrder removes duplicate tags; first occurrence wins.
func DedupeTagsPreserveOrder(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

// ValidateTags checks tag count and that each tag matches [a-z]{2,}.
func ValidateTags(tags []string) error {
	if len(tags) > MaxTagsPerVisit {
		return fmt.Errorf("at most %d tags allowed", MaxTagsPerVisit)
	}
	for _, t := range tags {
		if t == "" || !tagTokenPattern.MatchString(t) {
			return errors.New("each tag must be at least two lowercase letters a-z")
		}
	}
	return nil
}

// CountryVisitResponse is the response wrapper for GET /visits.
type CountryVisitResponse struct {
	Visits     []CountryVisit `json:"visits"`
	ShareToken string         `json:"shareToken"`
}

// ShareVisitsResponse is the response for GET /share/visits/:shareToken.
type ShareVisitsResponse struct {
	Visits   []CountryVisit `json:"visits"`
	UserName string         `json:"userName"`
	ImageUrl string         `json:"imageUrl"`
}
