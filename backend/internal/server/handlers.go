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

// GetShareVisitsHandler handles GET /share/visits/:shareToken. Unauthenticated; returns visits and userName for the user with that ShareToken.
func (s *Server) GetShareVisitsHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "GetShareVisitsHandler")
	defer span.End()

	shareToken := c.Param("shareToken")
	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "share token required"})
		return
	}
	log := logging.FromContext(ctx)
	user, err := s.db.GetUserByShareToken(ctx, shareToken)
	if err != nil {
		log.Error("GetUserByShareToken failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch share"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "share not found"})
		return
	}
	visits, err := s.db.GetCountryVisitsByUser(ctx, user.ID)
	if err != nil {
		log.Error("GetCountryVisitsByUser failed for share", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch visits"})
		return
	}
	if visits == nil {
		visits = []models.CountryVisit{}
	}
	c.JSON(http.StatusOK, models.ShareVisitsResponse{
		Visits:   visits,
		UserName: user.Name,
		ImageUrl: user.ImageURL,
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
	if visits == nil {
		visits = []models.CountryVisit{}
	}
	c.JSON(http.StatusOK, models.CountryVisitResponse{
		Visits:     visits,
		ShareToken: dbUser.ShareToken,
	})
}

// PutVisitsHandler handles PUT /visits.
// Creates a new country visit for the current user. Body: { "countryCode": "FI", "visitedTime": <Unix seconds> }.
// visitedTime is required and must be between 1900-01-01 and current date (inclusive).
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
		CountryCode string  `json:"countryCode"`
		VisitedTime *int64  `json:"visitedTime"` // Unix seconds; required
		MediaURL    *string `json:"mediaUrl,omitempty"`
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
	if body.VisitedTime == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visitedTime is required"})
		return
	}

	t := time.Unix(*body.VisitedTime, 0).UTC()
	minDate := time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)
	now := time.Now().UTC()
	maxDate := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, time.UTC)
	if t.Before(minDate) || t.After(maxDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visitedTime must be between 1900-01-01 and current date"})
		return
	}
	if body.MediaURL != nil && *body.MediaURL != "" && !models.ValidateMediaURL(*body.MediaURL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mediaUrl must be a well-formed URL (e.g. https://...)"})
		return
	}

	visit := &models.CountryVisit{
		CountryCode: body.CountryCode,
		VisitedTime: t,
		MediaURL:    body.MediaURL,
		UserID:      user.ID,
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

// PostFriendsHandler handles POST /friends.
// Adds a friend by ShareToken and Name. Returns 201 with the created friend, 409 if already added, 404 if share token invalid.
func (s *Server) PostFriendsHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "PostFriendsHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("POST /friends: user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	var body struct {
		ShareToken string `json:"shareToken"`
		Name       string `json:"name"`
		ImageUrl   string `json:"imageUrl"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Warn("Invalid POST /friends body", logging.Error, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if body.ShareToken == "" || body.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "shareToken and name are required"})
		return
	}
	// Validate that the share token corresponds to an existing user
	shareUser, err := s.db.GetUserByShareToken(ctx, body.ShareToken)
	if err != nil {
		log.Error("GetUserByShareToken failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate share token"})
		return
	}
	if shareUser == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "share not found"})
		return
	}
	imageURL := body.ImageUrl
	if imageURL == "" && shareUser.ImageURL != "" {
		imageURL = shareUser.ImageURL
	}
	friend, err := s.db.AddFriend(ctx, user.ID, body.ShareToken, body.Name, imageURL)
	if err != nil {
		if errors.Is(err, database.ErrFriendAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "friend already added"})
			return
		}
		log.Error("AddFriend failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add friend"})
		return
	}
	log.Info("Added friend", logging.UserID, user.ID, "shareToken", body.ShareToken)
	c.JSON(http.StatusCreated, friend)
}

// DeleteFriendHandler handles DELETE /friends/:shareToken.
// Removes the friend with the given ShareToken. Returns 204 on success, 404 if not found.
func (s *Server) DeleteFriendHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "DeleteFriendHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("DELETE /friends: user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	shareToken := c.Param("shareToken")
	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "shareToken is required"})
		return
	}
	err := s.db.DeleteFriendByShareToken(ctx, user.ID, shareToken)
	if err != nil {
		if errors.Is(err, database.ErrFriendNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Error("DeleteFriendByShareToken failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete friend"})
		return
	}
	log.Info("Deleted friend", logging.UserID, user.ID, "shareToken", shareToken)
	c.Status(http.StatusNoContent)
}

// GetFriendsHandler handles GET /friends. Returns the list of Friend objects for the current user.
func (s *Server) GetFriendsHandler(ctx context.Context, c *gin.Context) {
	ctx, span := tracing.New(ctx, "GetFriendsHandler")
	defer span.End()

	log := logging.FromContext(ctx)
	user, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if user == nil {
		log.Warn("GET /friends: user not in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id required"})
		return
	}
	friends, err := s.db.GetFriendsByUser(ctx, user.ID)
	if err != nil {
		log.Error("GetFriendsByUser failed", logging.Error, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch friends"})
		return
	}
	if friends == nil {
		friends = []models.Friend{}
	}
	c.JSON(http.StatusOK, models.LoginResponse{Friends: friends})
}
