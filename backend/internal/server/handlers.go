package server

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/matti777/my-countries/backend/internal/data"
	"github.com/matti777/my-countries/backend/internal/logging"
	"github.com/matti777/my-countries/backend/internal/models"
	"github.com/matti777/my-countries/backend/internal/tracing"
)

// GetCountriesHandler handles GET /countries.
// Returns the bundled list of all sovereign countries (in-memory Go slice).
func (s *Server) GetCountriesHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "GetCountriesHandler")
	defer span.End()

	c.JSON(http.StatusOK, models.CountryResponse{
		Countries: data.List,
	})
}

// GetListHandler handles GET /visits.
// Returns a list of country visits for the current user from the database.
func (s *Server) GetListHandler(ctx context.Context, c *gin.Context) {
	// Use the spec's trace API: ctx, span := trace.New(ctx, "name")
	ctx, span := tracing.New(ctx, "GetListHandler")
	defer span.End()

	// TODO: Extract user ID from authentication context
	// For now, using a placeholder - in production, this should come from
	// authenticated session/JWT token
	userID := c.GetString("user_id")
	if userID == "" {
		// Temporary: use a query parameter for testing
		// Remove this in production when auth is implemented
		userID = c.Query("user_id")
		if userID == "" {
			logging.LogWarning(ctx, "user_id required but not provided")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
			return
		}
	}

	logging.LogInfo(ctx, "Fetching country visits for user: %s", userID)

	// Create child span for database operation using spec's trace API
	dbCtx, dbSpan := tracing.New(ctx, "database::GetCountryVisitsByUser")
	defer dbSpan.End()

	visits, err := s.db.GetCountryVisitsByUser(dbCtx, userID)
	if err != nil {
		logging.LogError(dbCtx, "Failed to fetch country visits for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch country visits",
		})
		return
	}

	logging.LogInfo(dbCtx, "Successfully fetched %d country visits for user %s", len(visits), userID)
	c.JSON(http.StatusOK, models.CountryVisitResponse{
		Visits: visits,
	})
}
