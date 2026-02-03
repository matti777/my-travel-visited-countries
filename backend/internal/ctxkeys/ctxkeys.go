package ctxkeys

// Key is a type alias for string used as context keys
type Key string

// TraceContext holds parsed Traceparent header values for log correlation
type TraceContext struct {
	TraceID string
	SpanID  string
}

// Context keys for storing values in context
const (
	// TracerKey stores the Cloud Trace client instance
	TracerKey Key = "tracer"

	// LoggerKey stores the logger instance
	LoggerKey Key = "logger"

	// UserIDKey stores the current user ID
	UserIDKey Key = "user_id"

	// TraceContextKey stores parsed Traceparent (trace ID, span ID) for connecting logs to request trace
	TraceContextKey Key = "trace_context"
)
