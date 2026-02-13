package auth

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/lestrrat-go/jwx/v2/jwk"

	"github.com/matti777/my-countries/backend/internal/models"
)

const jwksRefreshInterval = 1 * time.Hour

// Firebase ID tokens are signed by Google; keys are at this global JWKS URL (not per-project).
// See https://firebase.google.com/docs/auth/admin/verify-id-tokens
const firebaseIDTokenJWKSURL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

// Claims holds verified Firebase ID token claims needed to build a User.
type Claims struct {
	Sub     string // Firebase UID
	Name    string
	Email   string
	Picture string // Profile photo URL (Firebase "picture" claim)
}

// Authenticator verifies Firebase ID tokens using JWKS with a 1-hour cache.
type Authenticator struct {
	projectID string
	jwksURL   string
	issuer    string
	audience  string
	cache     *jwk.Cache
	cacheOnce sync.Once
	cacheErr  error
	whitelist jwk.Whitelist
}

// NewAuthenticator creates an authenticator for the given Firebase project ID.
// Use the same project ID as the frontend's Firebase project (for issuer, JWKS, and aud).
// If firebaseProjectID is empty, projectID is used (so backend and frontend must use same project).
func NewAuthenticator(projectID string, firebaseProjectID string) (*Authenticator, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project ID is required")
	}
	// Use Firebase project for issuer/aud when provided (e.g. FIREBASE_PROJECT_ID when backend runs under a different GCP project)
	effective := projectID
	if firebaseProjectID != "" {
		effective = firebaseProjectID
	}
	issuer := "https://securetoken.google.com/" + effective
	wl := jwk.NewMapWhitelist().Add(firebaseIDTokenJWKSURL)
	return &Authenticator{
		projectID:   projectID,
		audience:    effective,
		jwksURL:     firebaseIDTokenJWKSURL,
		issuer:      issuer,
		whitelist:   wl,
	}, nil
}

// ensureCache initializes the JWKS cache once (1-hour TTL).
func (a *Authenticator) ensureCache(ctx context.Context) error {
	a.cacheOnce.Do(func() {
		a.cache = jwk.NewCache(ctx, jwk.WithRefreshWindow(jwksRefreshInterval))
		a.cacheErr = a.cache.Register(a.jwksURL,
			jwk.WithMinRefreshInterval(jwksRefreshInterval),
			jwk.WithFetchWhitelist(a.whitelist),
		)
		if a.cacheErr != nil {
			return
		}
		_, a.cacheErr = a.cache.Refresh(ctx, a.jwksURL)
	})
	return a.cacheErr
}

// VerifyIDToken verifies the Firebase ID token and returns claims (sub, name, email).
func (a *Authenticator) VerifyIDToken(ctx context.Context, idToken string) (*Claims, error) {
	if idToken == "" {
		return nil, fmt.Errorf("token is empty")
	}
	if err := a.ensureCache(ctx); err != nil {
		return nil, fmt.Errorf("jwks cache: %w", err)
	}
	keySet, err := a.cache.Get(ctx, a.jwksURL)
	if err != nil {
		return nil, fmt.Errorf("get jwks: %w", err)
	}
	// Allow 1 minute clock skew between client and server for exp/nbf validation
	const acceptableSkew = 1 * time.Minute
	tok, err := jwt.Parse([]byte(idToken),
		jwt.WithKeySet(keySet),
		jwt.WithValidate(true),
		jwt.WithIssuer(a.issuer),
		jwt.WithAudience(a.audience),
		jwt.WithAcceptableSkew(acceptableSkew),
	)
	if err != nil {
		return nil, fmt.Errorf("verify token: %w", err)
	}
	claims := &Claims{
		Sub: tok.Subject(),
	}
	if v, ok := tok.Get("name"); ok {
		if s, ok := v.(string); ok {
			claims.Name = s
		}
	}
	if v, ok := tok.Get("email"); ok {
		if s, ok := v.(string); ok {
			claims.Email = s
		}
	}
	if v, ok := tok.Get("picture"); ok {
		if s, ok := v.(string); ok {
			claims.Picture = s
		}
	}
	return claims, nil
}

// UserFromClaims builds a models.User from verified token claims.
func UserFromClaims(claims *Claims) *models.User {
	if claims == nil {
		return nil
	}
	return &models.User{
		ID:       claims.Sub,
		UserID:   claims.Sub,
		Name:     claims.Name,
		Email:    claims.Email,
		ImageURL: claims.Picture,
	}
}
