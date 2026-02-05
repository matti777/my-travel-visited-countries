package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
	"github.com/matti777/my-countries/backend/internal/models"
)

// Logger writes structured JSON logs to STDOUT, compatible with GCP structured log parser.
// It can carry optional trace ID/span ID and current_user_id so logs are connected to the request and user.
type Logger struct {
	projectID    string
	traceID      string
	spanID       string
	currentUserID string
}

// NewLogger creates a new logger instance that writes JSON to STDOUT
func NewLogger(ctx context.Context, projectID string) (*Logger, error) {
	return &Logger{projectID: projectID}, nil
}

// WithTraceFromContext returns a logger that includes trace correlation and current_user_id from ctx when present.
// Used by middleware to create the request-scoped logger to inject into context.
func (l *Logger) WithTraceFromContext(ctx context.Context) *Logger {
	if l == nil {
		return nil
	}
	out := &Logger{projectID: l.projectID, currentUserID: currentUserIDFromContext(ctx)}
	tc, _ := ctx.Value(ctxkeys.TraceContextKey).(*ctxkeys.TraceContext)
	if tc != nil && tc.TraceID != "" {
		out.traceID = tc.TraceID
		out.spanID = tc.SpanID
	}
	return out
}

// WithCurrentUserID returns a copy of the logger with current_user_id set.
// Used by auth middleware after the user is in context so handlers get a logger that already has user ID.
func (l *Logger) WithCurrentUserID(id string) *Logger {
	if l == nil {
		return nil
	}
	out := *l
	out.currentUserID = id
	return &out
}

// logEntry represents a single log entry in GCP structured log format
type logEntry struct {
	Severity  string                 `json:"severity"`
	Message   string                 `json:"message"`
	Timestamp string                 `json:"timestamp,omitempty"`
	Trace     string                 `json:"logging.googleapis.com/trace,omitempty"`
	SpanID    string                 `json:"logging.googleapis.com/spanId,omitempty"`
	Fields    map[string]interface{} `json:",omitempty"`
}

// currentUserIDFromContext returns the current user's ID from context when set by auth middleware.
func currentUserIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	u, _ := ctx.Value(ctxkeys.CurrentUserKey).(*models.User)
	if u == nil {
		return ""
	}
	return u.ID
}

// buildFieldsFromKeyValues converts alternating key, value pairs into a map for structured logging.
// keyValues must have even length; odd-indexed elements must be strings (keys).
// Error types are stored as their string form (Error()) so they serialize as readable text in JSON.
func buildFieldsFromKeyValues(keyValues ...interface{}) map[string]interface{} {
	if len(keyValues)%2 != 0 {
		return nil
	}
	fields := make(map[string]interface{}, len(keyValues)/2)
	for i := 0; i < len(keyValues); i += 2 {
		k, ok := keyValues[i].(string)
		if !ok {
			continue
		}
		v := keyValues[i+1]
		if err, ok := v.(error); ok {
			fields[k] = err.Error()
		} else {
			fields[k] = v
		}
	}
	return fields
}

// writeLog writes a single-line JSON log entry to STDOUT with structured fields.
// The logger's currentUserID is merged into fields as "current_user_id" when set.
func (l *Logger) writeLog(severity, message string, fields map[string]interface{}) {
	if l == nil {
		return
	}
	entry := logEntry{
		Severity:  severity,
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}
	if l.traceID != "" {
		entry.SpanID = l.spanID
		if l.projectID != "" {
			entry.Trace = fmt.Sprintf("projects/%s/traces/%s", l.projectID, l.traceID)
		}
	}
	if len(fields) > 0 || l.currentUserID != "" {
		entry.Fields = make(map[string]interface{}, len(fields)+1)
		for k, v := range fields {
			entry.Fields[k] = v
		}
		if l.currentUserID != "" {
			entry.Fields["current_user_id"] = l.currentUserID
		}
	}

	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		fmt.Fprintf(os.Stdout, "%s: %s\n", severity, message)
		return
	}

	os.Stdout.Write(jsonBytes)
	os.Stdout.WriteString("\n")
}

// Debug logs a message with optional structured key-value pairs (e.g. log.Debug("msg", logging.UserID, user.ID)).
func (l *Logger) Debug(msg string, keyValues ...interface{}) {
	if l == nil {
		return
	}
	l.writeLog("DEBUG", msg, buildFieldsFromKeyValues(keyValues...))
}

// Info logs a message with optional structured key-value pairs.
func (l *Logger) Info(msg string, keyValues ...interface{}) {
	if l == nil {
		return
	}
	l.writeLog("INFO", msg, buildFieldsFromKeyValues(keyValues...))
}

// Warn logs a message with optional structured key-value pairs.
func (l *Logger) Warn(msg string, keyValues ...interface{}) {
	if l == nil {
		return
	}
	l.writeLog("WARNING", msg, buildFieldsFromKeyValues(keyValues...))
}

// Error logs a message with optional structured key-value pairs.
func (l *Logger) Error(msg string, keyValues ...interface{}) {
	if l == nil {
		return
	}
	l.writeLog("ERROR", msg, buildFieldsFromKeyValues(keyValues...))
}

// WithContext returns a context with the logger stored in it
func WithContext(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, ctxkeys.LoggerKey, logger)
}

// FromContext retrieves the logger from context
func FromContext(ctx context.Context) *Logger {
	if logger, ok := ctx.Value(ctxkeys.LoggerKey).(*Logger); ok {
		return logger
	}
	return nil
}

// Close closes the logger (no-op for STDOUT logger)
func (l *Logger) Close() error {
	return nil
}
