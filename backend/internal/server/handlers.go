package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
	"github.com/matti777/my-countries/backend/internal/data"
	"github.com/matti777/my-countries/backend/internal/database"
	"github.com/matti777/my-countries/backend/internal/logging"
	"github.com/matti777/my-countries/backend/internal/models"
	"github.com/matti777/my-countries/backend/internal/tracing"
)

// PostLoginHandler handles POST /login.
// Ensures the user exists in the DB (creates with ShareToken if not). Called by frontend after Firebase login.
func (s *Server) PostLoginHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "PostLoginHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	log.Info("POST /login received")
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("POST /login: user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	if err := s.db.EnsureUser(ctx, user); err != nil {
		log.Error("POST /login: EnsureUser failed", logging.UserID, user.UserID, logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}
	log.Info("POST /login succeeded", logging.UserID, user.UserID)
	c.JSON(http.StatusOK, gin.H{})
}

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
// Returns a list of country visits for the current user and the user's ShareToken.
// Requires auth middleware (user in context). Reads User from DB for ShareToken.
func (s *Server) GetListHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "GetListHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	userID := user.ID

	dbCtx, dbSpan := tracing.New(ctx, "database::GetUserByID")
	dbUser, err := s.db.GetUserByID(dbCtx, userID)
	dbSpan.End()
	if err != nil {
		log.Error("Failed to get user", logging.UserID, userID, logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}
	if dbUser == nil {
		log.Warn("user not found in database; call POST /login first", logging.UserID, userID)
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found; complete login first"})
		return
	}

	log.Info("Fetching country visits for user", logging.UserID, userID)
	dbCtx2, dbSpan2 := tracing.New(ctx, "database::GetCountryVisitsByUser")
	visits, err := s.db.GetCountryVisitsByUser(dbCtx2, userID)
	dbSpan2.End()
	if err != nil {
		log.Error("Failed to fetch country visits for user", logging.UserID, userID, logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch country visits",
		})
		return
	}

	log.Info("Successfully fetched country visits for current user", logging.Count, len(visits))
	c.JSON(http.StatusOK, models.CountryVisitResponse{
		Visits:     visits,
		ShareToken: dbUser.ShareToken,
	})
}

// PutVisitsHandler handles PUT /visits.
// Creates a new country visit for the current user. Body: { "countryCode": "FI", "visitedTime": null (optional) }.
// Requires auth middleware.
func (s *Server) PutVisitsHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "PutVisitsHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}

	var body struct {
		CountryCode string `json:"countryCode"`
		VisitedTime *int64 `json:"visitedTime,omitempty"` // Unix seconds; optional
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Warn("Invalid PUT /visits body", logging.Error, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if body.CountryCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "countryCode is required"})
		return
	}
	if !models.ValidateCountryCode(body.CountryCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid countryCode"})
		return
	}

	visit := &models.CountryVisit{
		CountryCode: body.CountryCode,
		UserID:      user.ID,
	}
	if body.VisitedTime != nil {
		t := time.Unix(*body.VisitedTime, 0)
		visit.VisitedTime = &t
	}

	created, err := s.db.CreateCountryVisit(ctx, visit)
	if err != nil {
		log.Error("CreateCountryVisit failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create visit"})
		return
	}
	log.Info("Created country visit", logging.VisitID, created.ID, logging.UserID, user.ID)
	c.JSON(http.StatusCreated, created)
}

// DeleteVisitHandler handles DELETE /visits/:id.
// Deletes the country visit if it belongs to the current user. Returns 204 on success.
func (s *Server) DeleteVisitHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "DeleteVisitHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	visitID := c.Param("id")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visit id required"})
		return
	}

	err := s.db.DeleteCountryVisit(ctx, visitID, user.ID)
	if err != nil {
		if errors.Is(err, database.ErrVisitNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Error("DeleteCountryVisit failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete visit"})
		return
	}
	c.Status(http.StatusNoContent)
}
