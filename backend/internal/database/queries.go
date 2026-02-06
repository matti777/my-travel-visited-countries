package database

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/matti777/my-countries/backend/internal/models"
)

var (
	ErrVisitNotFound  = errors.New("visit not found")
	ErrVisitForbidden  = errors.New("visit belongs to another user")
)

// GetCountryVisitsByUser retrieves all country visits for a specific user.
func (c *Client) GetCountryVisitsByUser(ctx context.Context, userID string) ([]models.CountryVisit, error) {
	iter := c.Collection("country_visits").Where("user_id", "==", userID).Documents(ctx)
	defer iter.Stop()

	var visits []models.CountryVisit
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to iterate country visits: %w", err)
		}

		var visit models.CountryVisit
		if err := doc.DataTo(&visit); err != nil {
			return nil, fmt.Errorf("failed to unmarshal country visit: %w", err)
		}
		visit.ID = doc.Ref.ID
		visits = append(visits, visit)
	}

	return visits, nil
}

// EnsureUser creates the user document if it does not exist (get-or-create by ID).
// Uses the users collection with document ID = user.ID; stores Name and Email.
func (c *Client) EnsureUser(ctx context.Context, user *models.User) error {
	if user == nil || user.ID == "" {
		return fmt.Errorf("user ID is required")
	}
	ref := c.Collection("users").Doc(user.ID)
	snap, err := ref.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			// Document does not exist, create it below
		} else {
			return fmt.Errorf("failed to check user: %w", err)
		}
	} else if snap.Exists() {
		// Document exists, nothing to do
		return nil
	}
	// Create document with name and email (ID is the doc ID)
	_, err = ref.Set(ctx, map[string]interface{}{
		"name":  user.Name,
		"email": user.Email,
	})
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

// CreateCountryVisit adds a new country visit document and returns the visit with its Firestore ID set.
func (c *Client) CreateCountryVisit(ctx context.Context, visit *models.CountryVisit) (*models.CountryVisit, error) {
	if visit == nil {
		return nil, fmt.Errorf("visit is required")
	}
	if visit.UserID == "" || visit.CountryCode == "" {
		return nil, fmt.Errorf("user_id and country_code are required")
	}
	ref := c.Collection("country_visits").NewDoc()
	_, err := ref.Set(ctx, map[string]interface{}{
		"country_code":  visit.CountryCode,
		"visited_time":  visit.VisitedTime,
		"user_id":       visit.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create country visit: %w", err)
	}
	out := *visit
	out.ID = ref.ID
	return &out, nil
}

// DeleteCountryVisit deletes a country visit by ID. The visit must belong to userID.
// Returns ErrVisitNotFound if the document does not exist, ErrVisitForbidden if user_id does not match.
func (c *Client) DeleteCountryVisit(ctx context.Context, visitID string, userID string) error {
	if visitID == "" || userID == "" {
		return fmt.Errorf("visitID and userID are required")
	}
	ref := c.Collection("country_visits").Doc(visitID)
	snap, err := ref.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return ErrVisitNotFound
		}
		return fmt.Errorf("failed to get country visit: %w", err)
	}
	if !snap.Exists() {
		return ErrVisitNotFound
	}
	var visit models.CountryVisit
	if err := snap.DataTo(&visit); err != nil {
		return fmt.Errorf("failed to unmarshal country visit: %w", err)
	}
	if visit.UserID != userID {
		return ErrVisitForbidden
	}
	_, err = ref.Delete(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete country visit: %w", err)
	}
	return nil
}
