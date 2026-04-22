package data

import "strings"

// listedCodes is the set of CountryCode values from List for fast lookup.
var listedCodes map[string]struct{}

func init() {
	listedCodes = make(map[string]struct{}, len(List))
	for _, c := range List {
		listedCodes[c.CountryCode] = struct{}{}
	}
}

// IsListedCountry reports whether code is exactly one of the bundled sovereign
// country codes (2 uppercase ASCII letters). Use for API validation against data.List.
func IsListedCountry(code string) bool {
	n := strings.TrimSpace(code)
	if len(n) != 2 {
		return false
	}
	n = strings.ToUpper(n)
	if n[0] < 'A' || n[0] > 'Z' || n[1] < 'A' || n[1] > 'Z' {
		return false
	}
	_, ok := listedCodes[n]
	return ok
}
