package config

import (
	"context"
	"fmt"
	"os"
)

// Config holds application configuration
type Config struct {
	ProjectID string
	Port      string
	IsDebug   bool
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

	return &Config{
		ProjectID: projectID,
		Port:      port,
		IsDebug:   isDebug,
	}, nil
}
