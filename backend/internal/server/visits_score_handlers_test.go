package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
	"github.com/matti777/my-countries/backend/internal/models"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// scoreStubDB is a minimal Database stub for visit score handler tests.
type scoreStubDB struct {
	created *models.CountryVisit
	existing *models.CountryVisit
	replaced *models.CountryVisit
}

func (d *scoreStubDB) GetCountryVisitsByUser(ctx context.Context, userID string) ([]models.CountryVisit, error) {
	return nil, nil
}
func (d *scoreStubDB) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	return nil, nil
}
func (d *scoreStubDB) GetUserByShareToken(ctx context.Context, shareToken string) (*models.User, error) {
	return nil, nil
}
func (d *scoreStubDB) EnsureUser(ctx context.Context, user *models.User) error { return nil }
func (d *scoreStubDB) UpdateUserSettings(ctx context.Context, userID string, settings models.UserSettings) error {
	return nil
}
func (d *scoreStubDB) UpdateUserWishList(ctx context.Context, userID string, wishList []models.WishListCountry) error {
	return nil
}
func (d *scoreStubDB) CreateCountryVisit(ctx context.Context, visit *models.CountryVisit) (*models.CountryVisit, error) {
	out := *visit
	out.ID = "visit-1"
	d.created = &out
	return &out, nil
}
func (d *scoreStubDB) GetCountryVisit(ctx context.Context, visitID, userID string) (*models.CountryVisit, error) {
	if d.existing == nil {
		return nil, errVisitNotFoundForTest()
	}
	out := *d.existing
	return &out, nil
}
func (d *scoreStubDB) ReplaceCountryVisit(ctx context.Context, visit *models.CountryVisit) error {
	cp := *visit
	d.replaced = &cp
	return nil
}
func (d *scoreStubDB) DeleteCountryVisit(ctx context.Context, visitID string, userID string) error {
	return nil
}
func (d *scoreStubDB) GetFriendsByUser(ctx context.Context, userID string) ([]models.Friend, error) {
	return nil, nil
}
func (d *scoreStubDB) AddFriend(ctx context.Context, userID string, shareToken, name, imageURL string) (models.Friend, error) {
	return models.Friend{}, nil
}
func (d *scoreStubDB) DeleteFriendByShareToken(ctx context.Context, userID, shareToken string) error {
	return nil
}

// errVisitNotFoundForTest is set in TestMain/init via database package — see below.
var errVisitNotFoundForTest = func() error { return nil }

func newScoreTestServer(db Database) *Server {
	return &Server{db: db}
}

func authedScoreCtx(userID string) context.Context {
	return context.WithValue(context.Background(), ctxkeys.CurrentUserKey, &models.User{ID: userID})
}

func performJSON(
	t *testing.T,
	method, path string,
	body any,
	params gin.Params,
	fn func(ctx context.Context, c *gin.Context),
	ctx context.Context,
) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = params
	fn(ctx, c)
	return w
}

func TestPostVisitsHandler_ScoreRequired(t *testing.T) {
	db := &scoreStubDB{}
	s := newScoreTestServer(db)
	now := time.Now().UTC().Unix()

	w := performJSON(t, http.MethodPost, "/visits", map[string]any{
		"countryCode": "AF",
		"visitedTime": now,
	}, nil, s.PostVisitsHandler, authedScoreCtx("user-1"))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	if db.created != nil {
		t.Fatal("CreateCountryVisit must not be called when score is missing")
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	errMsg, _ := resp["error"].(string)
	if errMsg != "score is required" {
		t.Fatalf("error = %q, want %q", errMsg, "score is required")
	}
}

func TestPostVisitsHandler_ScoreOutOfRange(t *testing.T) {
	db := &scoreStubDB{}
	s := newScoreTestServer(db)
	now := time.Now().UTC().Unix()

	for _, score := range []int{0, -1, 101} {
		score := score
		w := performJSON(t, http.MethodPost, "/visits", map[string]any{
			"countryCode": "AF",
			"visitedTime": now,
			"score":       score,
		}, nil, s.PostVisitsHandler, authedScoreCtx("user-1"))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("score=%d status=%d, want 400; body=%s", score, w.Code, w.Body.String())
		}
	}
	if db.created != nil {
		t.Fatal("CreateCountryVisit must not be called for invalid scores")
	}
}

func TestPostVisitsHandler_ScorePersisted(t *testing.T) {
	db := &scoreStubDB{}
	s := newScoreTestServer(db)
	now := time.Now().UTC().Unix()

	w := performJSON(t, http.MethodPost, "/visits", map[string]any{
		"countryCode": "AF",
		"visitedTime": now,
		"score":       77,
	}, nil, s.PostVisitsHandler, authedScoreCtx("user-1"))

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", w.Code, w.Body.String())
	}
	if db.created == nil {
		t.Fatal("expected CreateCountryVisit")
	}
	if db.created.Score != 77 {
		t.Fatalf("persisted Score = %d, want 77", db.created.Score)
	}
	var resp models.CountryVisit
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	if resp.Score != 77 {
		t.Fatalf("response score = %d, want 77", resp.Score)
	}
}

func TestPutVisitHandler_ScoreOptionalButValidated(t *testing.T) {
	existing := &models.CountryVisit{
		ID:          "visit-1",
		CountryCode: "AF",
		VisitedTime: time.Now().UTC().Add(-24 * time.Hour),
		Score:       50,
		UserID:      "user-1",
		Tags:        []string{},
	}
	db := &scoreStubDB{existing: existing}
	s := newScoreTestServer(db)

	w := performJSON(t, http.MethodPut, "/visits/visit-1", map[string]any{
		"score": 101,
	}, gin.Params{{Key: "id", Value: "visit-1"}}, s.PutVisitHandler, authedScoreCtx("user-1"))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	if db.replaced != nil {
		t.Fatal("ReplaceCountryVisit must not be called for invalid score")
	}

	w = performJSON(t, http.MethodPut, "/visits/visit-1", map[string]any{
		"score": 12,
	}, gin.Params{{Key: "id", Value: "visit-1"}}, s.PutVisitHandler, authedScoreCtx("user-1"))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if db.replaced == nil || db.replaced.Score != 12 {
		t.Fatalf("replaced score = %v, want 12", db.replaced)
	}
}

func TestPutVisitHandler_ScoreCountsAsUpdateField(t *testing.T) {
	db := &scoreStubDB{}
	s := newScoreTestServer(db)

	w := performJSON(t, http.MethodPut, "/visits/visit-1", map[string]any{},
		gin.Params{{Key: "id", Value: "visit-1"}}, s.PutVisitHandler, authedScoreCtx("user-1"))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("empty body status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}
