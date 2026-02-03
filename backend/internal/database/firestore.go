package database

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/option"
)

// Client wraps Firestore client
type Client struct {
	*firestore.Client
}

// NewClient creates a new Firestore client
func NewClient(ctx context.Context, projectID string) (*Client, error) {
	client, err := firestore.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %w", err)
	}

	return &Client{Client: client}, nil
}

// NewClientWithCredentials creates a new Firestore client with credentials
func NewClientWithCredentials(ctx context.Context, projectID string, credentialsFile string) (*Client, error) {
	client, err := firestore.NewClient(ctx, projectID, option.WithCredentialsFile(credentialsFile))
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %w", err)
	}

	return &Client{Client: client}, nil
}

// Close closes the Firestore client
func (c *Client) Close() error {
	return c.Client.Close()
}
