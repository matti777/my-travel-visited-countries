package models

import (
	"fmt"
	"regexp"
	"strings"
)

// ValidationErrors is a 400 Bad Request body that maps API field names to messages.
type ValidationErrors struct {
	Error  string            `json:"error"`
	Fields map[string]string `json:"fields"`
}

// NewValidationErrors builds a ValidationErrors response.
func NewValidationErrors(fields map[string]string) ValidationErrors {
	return ValidationErrors{
		Error:  "validation failed",
		Fields: fields,
	}
}

var instagramUserNamePattern = regexp.MustCompile(`^[A-Za-z0-9._]{1,30}$`)

// NormalizeInstagramUserName trims whitespace and a leading @.
func NormalizeInstagramUserName(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "@")
	return strings.TrimSpace(s)
}

// ValidateInstagramUserName checks Instagram username format (no live lookup).
// Rules: 1–30 chars; letters, digits, ., _; no leading/trailing .; no .. .
func ValidateInstagramUserName(s string) error {
	if s == "" {
		return fmt.Errorf("instagram username is required")
	}
	if !instagramUserNamePattern.MatchString(s) {
		return fmt.Errorf("invalid Instagram username")
	}
	if strings.HasPrefix(s, ".") || strings.HasSuffix(s, ".") {
		return fmt.Errorf("invalid Instagram username")
	}
	if strings.Contains(s, "..") {
		return fmt.Errorf("invalid Instagram username")
	}
	return nil
}
