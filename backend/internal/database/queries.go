package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/matti777/my-countries/backend/internal/models"
)

var (
	ErrVisitNotFound = errors.New("visit not found")
)

// GetCountryVisitsByUser retrieves all country visits for a user. userID is the auth User ID (Firestore document ID).
func (c *Client) GetCountryVisitsByUser(ctx context.Context, userID string) ([]models.CountryVisit, error) {
	iter := c.Collection("users").Doc(userID).Collection("country_visits").Documents(ctx)
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
		visit.UserID = userID
		visits = append(visits, visit)
	}

	return visits, nil
}

// EnsureUser gets or creates the user document with document ID = user.ID (auth token UserID). On create, stores ShareToken, Name, Email.
// Only POST /login should call this; auth middleware does not.
func (c *Client) EnsureUser(ctx context.Context, user *models.User) error {
	if user == nil || user.ID == "" {
		return fmt.Errorf("user ID is required")
	}
	ref := c.Collection("users").Doc(user.ID)
	_, err := ref.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			shareToken := uuid.New().String()
			_, err = ref.Set(ctx, map[string]interface{}{
				"ShareToken": shareToken,
				"Name":       user.Name,
				"Email":      user.Email,
			})
			if err != nil {
				return fmt.Errorf("failed to create user: %w", err)
			}
			return nil
		}
		return fmt.Errorf("failed to check user: %w", err)
	}
	// Doc exists
	return nil
}

// GetUserByShareToken looks up the User document by ShareToken. Returns (nil, nil) if not found.
func (c *Client) GetUserByShareToken(ctx context.Context, shareToken string) (*models.User, error) {
	if shareToken == "" {
		return nil, fmt.Errorf("shareToken is required")
	}
	iter := c.Collection("users").Where("ShareToken", "==", shareToken).Limit(1).Documents(ctx)
	docSnap, err := iter.Next()
	if err == iterator.Done {
		iter.Stop()
		return nil, nil
	}
	if err != nil {
		iter.Stop()
		return nil, fmt.Errorf("failed to get user by share token: %w", err)
	}
	if !docSnap.Exists() {
		iter.Stop()
		return nil, nil
	}
	iter.Stop()
	var u models.User
	if err := docSnap.DataTo(&u); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user: %w", err)
	}
	u.ID = docSnap.Ref.ID
	u.UserID = u.ID
	return &u, nil
}

// GetUserByID looks up the User document by ID (auth token UserID). Returns (nil, nil) if not found.
func (c *Client) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	if userID == "" {
		return nil, fmt.Errorf("userID is required")
	}
	ref := c.Collection("users").Doc(userID)
	snap, err := ref.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if !snap.Exists() {
		return nil, nil
	}
	var u models.User
	if err := snap.DataTo(&u); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user: %w", err)
	}
	u.ID = snap.Ref.ID
	u.UserID = u.ID
	return &u, nil
}

// CreateCountryVisit adds a new country visit document under users/{userID}/country_visits.
// Document contains only CountryCode and VisitTime (user is implied by path).
func (c *Client) CreateCountryVisit(ctx context.Context, visit *models.CountryVisit) (*models.CountryVisit, error) {
	if visit == nil {
		return nil, fmt.Errorf("visit is required")
	}
	if visit.UserID == "" || visit.CountryCode == "" {
		return nil, fmt.Errorf("user_id and country_code are required")
	}
	ref := c.Collection("users").Doc(visit.UserID).Collection("country_visits").NewDoc()
	_, err := ref.Set(ctx, map[string]interface{}{
		"CountryCode": visit.CountryCode,
		"VisitTime":   visit.VisitedTime,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create country visit: %w", err)
	}
	out := *visit
	out.ID = ref.ID
	return &out, nil
}

// DeleteCountryVisit deletes a country visit by ID from users/{userID}/country_visits.
// Returns ErrVisitNotFound if the document does not exist.
func (c *Client) DeleteCountryVisit(ctx context.Context, visitID string, userID string) error {
	if visitID == "" || userID == "" {
		return fmt.Errorf("visitID and userID are required")
	}
	ref := c.Collection("users").Doc(userID).Collection("country_visits").Doc(visitID)
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
	_, err = ref.Delete(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete country visit: %w", err)
	}
	return nil
}
