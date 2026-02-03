package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
)

// Logger writes structured JSON logs to STDOUT, compatible with GCP structured log parser.
// It can carry optional trace ID/span ID so logs are connected to the request trace (Traceparent).
type Logger struct {
	projectID string
	traceID   string
	spanID    string
}

// NewLogger creates a new logger instance that writes JSON to STDOUT
func NewLogger(ctx context.Context, projectID string) (*Logger, error) {
	return &Logger{projectID: projectID}, nil
}

// WithTraceFromContext returns a logger that includes trace correlation from ctx when present.
// Used to bind the logger to the current request's Traceparent so logs connect to the request trace.
// If ctx has no trace context, returns a copy of the logger with no trace set.
func (l *Logger) WithTraceFromContext(ctx context.Context) *Logger {
	if l == nil {
		return nil
	}
	tc, _ := ctx.Value(ctxkeys.TraceContextKey).(*ctxkeys.TraceContext)
	if tc == nil || tc.TraceID == "" {
		return &Logger{projectID: l.projectID}
	}
	return &Logger{
		projectID: l.projectID,
		traceID:   tc.TraceID,
		spanID:    tc.SpanID,
	}
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

// writeLog writes a single-line JSON log entry to STDOUT
func (l *Logger) writeLog(severity, format string, args ...interface{}) {
	entry := logEntry{
		Severity:  severity,
		Message:   fmt.Sprintf(format, args...),
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}
	if l != nil && l.traceID != "" {
		entry.SpanID = l.spanID
		if l.projectID != "" {
			entry.Trace = fmt.Sprintf("projects/%s/traces/%s", l.projectID, l.traceID)
		}
	}

	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		// Fallback: write plain text if JSON marshaling fails
		fmt.Fprintf(os.Stdout, "%s: %s\n", severity, fmt.Sprintf(format, args...))
		return
	}

	os.Stdout.Write(jsonBytes)
	os.Stdout.WriteString("\n")
}

// Debug logs a debug message
func (l *Logger) Debug(format string, args ...interface{}) {
	l.writeLog("DEBUG", format, args...)
}

// Debugf logs a formatted debug message (alias for Debug)
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.Debug(format, args...)
}

// Info logs an info message
func (l *Logger) Info(format string, args ...interface{}) {
	l.writeLog("INFO", format, args...)
}

// Infof logs a formatted info message (alias for Info)
func (l *Logger) Infof(format string, args ...interface{}) {
	l.Info(format, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(format string, args ...interface{}) {
	l.writeLog("WARNING", format, args...)
}

// Warnf logs a formatted warning message (alias for Warn)
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.Warn(format, args...)
}

// Warning logs a warning message (alias for Warn)
func (l *Logger) Warning(format string, args ...interface{}) {
	l.Warn(format, args...)
}

// Warningf logs a formatted warning message (alias for Warnf)
func (l *Logger) Warningf(format string, args ...interface{}) {
	l.Warnf(format, args...)
}

// Error logs an error message
func (l *Logger) Error(format string, args ...interface{}) {
	l.writeLog("ERROR", format, args...)
}

// Errorf logs a formatted error message (alias for Error)
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.Error(format, args...)
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

// LogDebug logs a debug message using the logger from context
func LogDebug(ctx context.Context, format string, args ...interface{}) {
	if logger := FromContext(ctx); logger != nil {
		logger.Debugf(format, args...)
	}
}

// LogInfo logs an info message using the logger from context
func LogInfo(ctx context.Context, format string, args ...interface{}) {
	if logger := FromContext(ctx); logger != nil {
		logger.Infof(format, args...)
	}
}

// LogWarning logs a warning message using the logger from context
func LogWarning(ctx context.Context, format string, args ...interface{}) {
	if logger := FromContext(ctx); logger != nil {
		logger.Warningf(format, args...)
	}
}

// LogError logs an error message using the logger from context
func LogError(ctx context.Context, format string, args ...interface{}) {
	if logger := FromContext(ctx); logger != nil {
		logger.Errorf(format, args...)
	}
}

// Close closes the logger (no-op for STDOUT logger)
func (l *Logger) Close() error {
	return nil
}
