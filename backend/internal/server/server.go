package server

import (
	"context"
	"embed"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/matti777/my-countries/backend/internal/auth"
	"github.com/matti777/my-countries/backend/internal/ctxkeys"
	"github.com/matti777/my-countries/backend/internal/logging"
	"github.com/matti777/my-countries/backend/internal/models"
	"github.com/matti777/my-countries/backend/internal/tracing"
)

// Server wraps the Gin engine and dependencies
type Server struct {
	Router   *gin.Engine
	db       Database
	auth     *auth.Authenticator
	StaticFS embed.FS
}

// Database interface for database operations
type Database interface {
	GetCountryVisitsByUser(ctx context.Context, userID string) ([]models.CountryVisit, error)
	GetUserByID(ctx context.Context, userID string) (*models.User, error)
	EnsureUser(ctx context.Context, user *models.User) error
	CreateCountryVisit(ctx context.Context, visit *models.CountryVisit) (*models.CountryVisit, error)
	DeleteCountryVisit(ctx context.Context, visitID string, userID string) error
}

// NewServer creates a new server instance
func NewServer(ctx context.Context, db Database, authenticator *auth.Authenticator, staticFS embed.FS) *Server {
	router := gin.Default()

	s := &Server{
		Router:   router,
		db:       db,
		auth:     authenticator,
		StaticFS: staticFS,
	}

	// COOP: allow Firebase Auth popup to check window.closed without console error
	s.Router.Use(func(c *gin.Context) {
		c.Header("Cross-Origin-Opener-Policy", "unsafe-none")
		c.Next()
	})
	// Traceparent first so trace is in context before any logging
	s.Router.Use(s.traceparentMiddleware())
	// Then context: tracer and request-scoped logger (with trace from Traceparent)
	s.Router.Use(s.contextMiddleware(ctx))
	// Then tracing (span creation)
	s.Router.Use(s.tracingMiddleware())

	return s
}

// traceparentMiddleware parses the Traceparent header and injects trace ID/span ID into context.
// Must run before any middleware that logs so the logger can connect logs to the request trace.
func (s *Server) traceparentMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqCtx := c.Request.Context()
		if tc := logging.ParseTraceparent(c.GetHeader("Traceparent")); tc != nil {
			reqCtx = context.WithValue(reqCtx, ctxkeys.TraceContextKey, tc)
		}
		c.Request = c.Request.WithContext(reqCtx)
		c.Next()
	}
}

// contextMiddleware injects tracer and logger into request context.
// Logger is always present (set at startup in main); nil checks are not used.
func (s *Server) contextMiddleware(ctx context.Context) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqCtx := c.Request.Context()
		if tracer := tracing.FromContext(ctx); tracer != nil {
			reqCtx = tracer.WithContext(reqCtx)
		}
		logger := logging.FromContext(ctx)
		reqLogger := logger.WithTraceFromContext(reqCtx)
		reqCtx = logging.WithContext(reqCtx, reqLogger)
		c.Request = c.Request.WithContext(reqCtx)
		c.Next()
	}
}

// tracingMiddleware extracts trace context from HTTP headers and injects it into Gin context
func (s *Server) tracingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Get tracer from context
		tracer := tracing.FromContext(ctx)

		// Extract trace context from header (App Engine injects X-Cloud-Trace-Context)
		traceHeader := c.GetHeader("X-Cloud-Trace-Context")

		if tracer != nil && traceHeader != "" {
			spanCtx, span := tracer.StartSpanFromHeader(ctx, traceHeader, c.Request.Method+" "+c.FullPath())
			c.Request = c.Request.WithContext(spanCtx)
			c.Set("trace_span", span)

			// Finish span when request completes
			defer span.End()
		}

		c.Next()
	}
}

// authMiddleware requires a valid Firebase ID token in Authorization: Bearer <token>.
// On success it injects *models.User (from token claims only; no DB lookup) into request context.
// User document in DB is created by POST /login (EnsureUser), not by this middleware.
// On failure it returns 401 and does not call next.
func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		authz := c.GetHeader("Authorization")
		if authz == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}
		const prefix = "Bearer "
		if !strings.HasPrefix(authz, prefix) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Authorization format"})
			return
		}
		token := strings.TrimSpace(authz[len(prefix):])
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		log := logging.FromContext(ctx)
		claims, err := s.auth.VerifyIDToken(ctx, token)
		if err != nil {
			log.Warn("Token verification failed", logging.Error, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		user := auth.UserFromClaims(claims)
		ctx = context.WithValue(ctx, ctxkeys.CurrentUserKey, user)
		ctx = logging.WithContext(ctx, log.WithCurrentUserID(user.UserID))
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// staticHandler serves embedded frontend files. "/" and missing paths serve index.html (SPA fallback).
// Cache: index.html not cached; assets (JS, CSS, images) heavily cached.
func (s *Server) staticHandler(c *gin.Context) {
	if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
		c.Status(http.StatusNotFound)
		return
	}
	reqPath := strings.TrimPrefix(c.Request.URL.Path, "/")
	if reqPath == "" {
		reqPath = "index.html"
	}
	// Open from embedded FS (paths under static/)
	fsPath := path.Join("static", reqPath)
	f, err := s.StaticFS.Open(fsPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// SPA fallback: serve index.html
			f, err = s.StaticFS.Open("static/index.html")
			if err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
			defer f.Close()
			stat, _ := f.Stat()
			c.Header("Cache-Control", "no-store")
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
			c.Status(http.StatusOK)
			io.Copy(c.Writer, f)
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}
	defer f.Close()
	stat, err := f.Stat()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	if stat.IsDir() {
		// Don't list directories; treat as not found and fallback to index.html
		f.Close()
		f, _ = s.StaticFS.Open("static/index.html")
		if f == nil {
			c.Status(http.StatusNotFound)
			return
		}
		defer f.Close()
		stat, _ = f.Stat()
		c.Header("Cache-Control", "no-store")
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
		c.Status(http.StatusOK)
		io.Copy(c.Writer, f)
		return
	}
	// Set cache headers: index.html no-store; assets heavy cache (reqPath is URL path, not fs path)
	if reqPath == "index.html" {
		c.Header("Cache-Control", "no-store")
	} else if strings.HasPrefix(reqPath, "assets/") || isHeavyCacheExt(path.Ext(reqPath)) {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	}
	contentType := contentTypeByExt(path.Ext(reqPath))
	if contentType != "" {
		c.Header("Content-Type", contentType)
	}
	c.Header("Content-Length", strconv.FormatInt(stat.Size(), 10))
	c.Status(http.StatusOK)
	io.Copy(c.Writer, f)
}

func isHeavyCacheExt(ext string) bool {
	switch strings.ToLower(ext) {
	case ".js", ".css", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".woff", ".woff2":
		return true
	}
	return false
}

func contentTypeByExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	}
	return ""
}
