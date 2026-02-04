package server

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
	"github.com/matti777/my-countries/backend/internal/logging"
	"github.com/matti777/my-countries/backend/internal/models"
	"github.com/matti777/my-countries/backend/internal/tracing"
)

// Server wraps the Gin engine and dependencies
type Server struct {
	Router *gin.Engine
	db     Database
}

// Database interface for database operations
type Database interface {
	GetCountryVisitsByUser(ctx context.Context, userID string) ([]models.CountryVisit, error)
}

// NewServer creates a new server instance
func NewServer(ctx context.Context, db Database) *Server {
	router := gin.Default()

	s := &Server{
		Router: router,
		db:     db,
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

// contextMiddleware injects tracer and logger into request context
func (s *Server) contextMiddleware(ctx context.Context) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Inject tracer and logger from parent context into request context
		reqCtx := c.Request.Context()
		if tracer := tracing.FromContext(ctx); tracer != nil {
			reqCtx = tracer.WithContext(reqCtx)
		}
		if logger := logging.FromContext(ctx); logger != nil {
			// Bind logger to request trace (Traceparent) so logs include trace correlation
			reqLogger := logger.WithTraceFromContext(reqCtx)
			reqCtx = logging.WithContext(reqCtx, reqLogger)
		}
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
