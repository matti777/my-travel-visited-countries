package config

import (
	"context"
	"fmt"
	"os"
)

// Config holds application configuration
type Config struct {
	ProjectID          string
	Port               string
	IsDebug            bool
	FirebaseProjectID  string // optional; Firebase project ID for JWT verification (must match frontend VITE_FIREBASE_PROJECT_ID). Falls back to FIREBASE_AUDIENCE then GOOGLE_CLOUD_PROJECT.
}

// Load loads configuration from environment variables
func Load(ctx context.Context) (*Config, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT_ID")
	}
	if projectID == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID environment variable must be set")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Determine if we're in debug/local mode
	// If APP_ENV=debug or GOOGLE_CLOUD_PROJECT is not set, we're in debug mode
	isDebug := os.Getenv("APP_ENV") == "debug" || projectID == ""

	// Firebase project ID for token verification: same as frontend's VITE_FIREBASE_PROJECT_ID when backend runs under a different GCP project
	firebaseProjectID := os.Getenv("FIREBASE_PROJECT_ID")
	if firebaseProjectID == "" {
		firebaseProjectID = os.Getenv("FIREBASE_AUDIENCE")
	}

	return &Config{
		ProjectID:         projectID,
		Port:              port,
		IsDebug:           isDebug,
		FirebaseProjectID: firebaseProjectID,
	}, nil
}
