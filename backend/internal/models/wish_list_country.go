package models

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// MaxWishListEntries is the maximum number of countries on a user's wish list.
const MaxWishListEntries = 5

// MaxWishListDescriptionLength is the maximum Unicode characters in a wish-list description.
const MaxWishListDescriptionLength = 500

// WishListCountry is a country on the user's wish list (see data-models.md).
type WishListCountry struct {
	CountryCode string `firestore:"CountryCode" json:"countryCode"`
	Description string `firestore:"Description,omitempty" json:"description,omitempty"`
}

// ValidateWishList checks wish-list length, unique listed country codes, and descriptions.
func ValidateWishList(
	entries []WishListCountry,
	isListedCountry func(string) bool,
) error {
	if isListedCountry == nil {
		return fmt.Errorf("country validator is required")
	}
	if len(entries) > MaxWishListEntries {
		return fmt.Errorf("at most %d wish-list entries allowed", MaxWishListEntries)
	}
	seen := make(map[string]struct{}, len(entries))
	for i, e := range entries {
		code := strings.ToUpper(strings.TrimSpace(e.CountryCode))
		if code == "" {
			return fmt.Errorf("wishList[%d].countryCode is required", i)
		}
		if !isListedCountry(code) {
			return fmt.Errorf("wishList[%d].countryCode is invalid", i)
		}
		if _, dup := seen[code]; dup {
			return fmt.Errorf("wishList[%d].countryCode must be unique", i)
		}
		seen[code] = struct{}{}
		if err := ValidateWishListDescription(e.Description); err != nil {
			return fmt.Errorf("wishList[%d].description: %w", i, err)
		}
	}
	return nil
}

// ValidateWishListDescription returns an error if description exceeds MaxWishListDescriptionLength.
func ValidateWishListDescription(description string) error {
	if utf8.RuneCountInString(description) > MaxWishListDescriptionLength {
		return fmt.Errorf(
			"description must be at most %d characters",
			MaxWishListDescriptionLength,
		)
	}
	return nil
}

// NormalizeWishList normalizes country codes to uppercase and returns a non-nil slice.
func NormalizeWishList(entries []WishListCountry) []WishListCountry {
	if len(entries) == 0 {
		return []WishListCountry{}
	}
	out := make([]WishListCountry, len(entries))
	for i, e := range entries {
		out[i] = WishListCountry{
			CountryCode: strings.ToUpper(strings.TrimSpace(e.CountryCode)),
			Description: e.Description,
		}
	}
	return out
}

// WishListToResponse builds the JSON body for GET/PUT /wishlist.
func WishListToResponse(entries []WishListCountry) map[string]interface{} {
	normalized := NormalizeWishList(entries)
	items := make([]map[string]interface{}, len(normalized))
	for i, e := range normalized {
		item := map[string]interface{}{
			"countryCode": e.CountryCode,
		}
		if e.Description != "" {
			item["description"] = e.Description
		}
		items[i] = item
	}
	return map[string]interface{}{
		"wishList": items,
	}
}
