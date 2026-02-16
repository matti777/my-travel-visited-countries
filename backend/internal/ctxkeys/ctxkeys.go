package ctxkeys

// Key is a type alias for string used as context keys
type Key string

// TraceContext holds parsed Traceparent header values for log correlation
type TraceContext struct {
	TraceID string
	SpanID  string
	Sampled bool // true when W3C trace flags are "01"
}

// contextKey is a private type so only this package can create keys that store *models.User.
// Values stored under this key must be *models.User.
type contextKey int

const (
	_ contextKey = iota
	// CurrentUserKey stores the authenticated *models.User in request context.
	// Used by auth middleware and read by handlers and logging.
	CurrentUserKey
)

// Context keys for storing values in context
const (
	// TracerKey stores the Cloud Trace client instance
	TracerKey Key = "tracer"

	// LoggerKey stores the logger instance
	LoggerKey Key = "logger"

	// UserIDKey stores the current user ID (legacy; prefer CurrentUserKey with *models.User)
	UserIDKey Key = "user_id"

	// TraceContextKey stores parsed Traceparent (trace ID, span ID) for connecting logs to request trace
	TraceContextKey Key = "trace_context"
)
