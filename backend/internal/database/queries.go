package database

import (
	"context"
	"fmt"

	"google.golang.org/api/iterator"

	"github.com/matti777/my-countries/backend/internal/models"
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
