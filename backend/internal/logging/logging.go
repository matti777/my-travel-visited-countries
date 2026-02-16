package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
)

// Logger writes structured JSON logs to STDOUT, compatible with GCP
// structured log parser. It can carry optional trace/span and request-scoped
// labels (e.g. current_user_id set by auth middleware).
//
// See https://docs.cloud.google.com/logging/docs/structured-logging
type Logger struct {
	projectID    string
	traceID      string
	spanID       string
	traceSampled bool
	labels       map[string]string // request-scoped labels merged into every entry
}

// NewLogger creates a new logger instance that writes JSON to STDOUT
func NewLogger(ctx context.Context, projectID string) (*Logger, error) {
	return &Logger{projectID: projectID}, nil
}

// WithTraceFromContext returns a logger that includes trace correlation from ctx when present.
// Used by middleware to create the request-scoped logger to inject into context.
func (l *Logger) WithTraceFromContext(ctx context.Context) *Logger {
	if l == nil {
		return nil
	}
	out := &Logger{projectID: l.projectID, labels: copyLabels(l.labels)}
	tc, _ := ctx.Value(ctxkeys.TraceContextKey).(*ctxkeys.TraceContext)
	if tc != nil && tc.TraceID != "" {
		out.traceID = tc.TraceID
		out.spanID = tc.SpanID
		out.traceSampled = tc.Sampled
	}
	return out
}

func copyLabels(m map[string]string) map[string]string {
	if len(m) == 0 {
		return nil
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// WithParams returns a new logger with additional label key-value pairs attached.
// keyValues must have even length: key1, value1, key2, value2, ... Keys must be strings; values are converted to string (errors use Error()).
func (l *Logger) WithParams(keyValues ...interface{}) *Logger {
	if l == nil {
		return nil
	}
	if len(keyValues)%2 != 0 {
		return l
	}
	extra := make(map[string]string, len(keyValues)/2)
	for i := 0; i < len(keyValues); i += 2 {
		k, ok := keyValues[i].(string)
		if !ok {
			continue
		}
		v := keyValues[i+1]
		if err, ok := v.(error); ok {
			extra[k] = err.Error()
		} else {
			extra[k] = fmt.Sprint(v)
		}
	}
	if len(extra) == 0 {
		return l
	}
	out := &Logger{
		projectID:    l.projectID,
		traceID:      l.traceID,
		spanID:       l.spanID,
		traceSampled: l.traceSampled,
		labels:       mergeLabels(l.labels, extra),
	}
	return out
}

// logEntry represents a single log entry in GCP structured log format
type logEntry struct {
	Severity     string            `json:"severity"`
	Message      string            `json:"message"`
	Timestamp    string            `json:"timestamp,omitempty"`
	Trace        string            `json:"logging.googleapis.com/trace,omitempty"`
	SpanID       string            `json:"logging.googleapis.com/spanId,omitempty"`
	TraceSampled bool              `json:"logging.googleapis.com/trace_sampled,omitempty"`
	Labels       map[string]string `json:"logging.googleapis.com/labels,omitempty"`
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

// fieldsToLabelStrings converts per-call key-values to string-only map for Cloud Logging labels.
func fieldsToLabelStrings(fields map[string]interface{}) map[string]string {
	if len(fields) == 0 {
		return nil
	}
	out := make(map[string]string, len(fields))
	for k, v := range fields {
		if err, ok := v.(error); ok {
			out[k] = err.Error()
		} else {
			out[k] = fmt.Sprint(v)
		}
	}
	return out
}

// mergeLabels merges request-scoped labels with per-call fields (both string maps). Logger labels first, then fields (fields override).
func mergeLabels(loggerLabels map[string]string, fieldLabels map[string]string) map[string]string {
	n := len(loggerLabels) + len(fieldLabels)
	if n == 0 {
		return nil
	}
	out := make(map[string]string, n)
	for k, v := range loggerLabels {
		out[k] = v
	}
	for k, v := range fieldLabels {
		out[k] = v
	}
	return out
}

// writeLog writes a single-line JSON log entry to STDOUT. Custom fields go to logging.googleapis.com/labels.
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
		entry.TraceSampled = l.traceSampled
		if l.projectID != "" {
			entry.Trace = fmt.Sprintf("projects/%s/traces/%s", l.projectID, l.traceID)
		}
	}
	fieldLabels := fieldsToLabelStrings(fields)
	entry.Labels = mergeLabels(l.labels, fieldLabels)

	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		fmt.Fprintf(os.Stdout, "%s: %s\n", severity, message)
		return
	}

	os.Stdout.Write(jsonBytes)
	os.Stdout.WriteString("\n")
}

// Debug logs a message with optional structured key-value pairs (e.g. log.Debug("msg", logging.UserID, user.UserID)).
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
