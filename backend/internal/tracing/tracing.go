package tracing

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"strings"

	texporter "github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace"
	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
)

// Client wraps OpenTelemetry tracing configured to export to Google Cloud Trace.
type Client struct {
	tp     *sdktrace.TracerProvider
	tracer oteltrace.Tracer
}

// NewClient sets up an OpenTelemetry TracerProvider with a Google Cloud Trace exporter.
// isDebug determines sampling: true = always sample (local), false = sample 1/10 (cloud)
func NewClient(ctx context.Context, projectID string, isDebug bool) (*Client, error) {
	opts := []texporter.Option{}
	if projectID != "" {
		opts = append(opts, texporter.WithProjectID(projectID))
	}

	exp, err := texporter.New(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create cloud trace exporter: %w", err)
	}

	// Configure sampling: always in debug/local, 1/10 in cloud
	var sampler sdktrace.Sampler
	if isDebug {
		sampler = sdktrace.AlwaysSample()
	} else {
		sampler = sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithSampler(sampler),
	)
	otel.SetTracerProvider(tp)

	return &Client{
		tp:     tp,
		tracer: tp.Tracer("github.com/matti777/my-countries/backend"),
	}, nil
}

// StartSpan creates a new span.
func (c *Client) StartSpan(ctx context.Context, name string) (context.Context, oteltrace.Span) {
	return c.tracer.Start(ctx, name)
}

// Close shuts down the tracer provider (flushes spans).
func (c *Client) Close() error {
	if c.tp == nil {
		return nil
	}
	return c.tp.Shutdown(context.Background())
}

// WithContext returns a context with the tracer stored in it
func (c *Client) WithContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxkeys.TracerKey, c)
}

// FromContext retrieves the tracer from context
func FromContext(ctx context.Context) *Client {
	if tracer, ok := ctx.Value(ctxkeys.TracerKey).(*Client); ok {
		return tracer
	}
	return nil
}

// ExtractTraceContext extracts trace context from the Google Cloud header.
// App Engine automatically injects X-Cloud-Trace-Context header
func ExtractTraceContext(traceHeader string) (traceID, spanID string, sampled bool) {
	if traceHeader == "" {
		return "", "", false
	}

	// Format: TRACE_ID/SPAN_ID;o=TRACE_TRUE
	parts := strings.Split(traceHeader, "/")
	if len(parts) < 2 {
		return "", "", false
	}

	traceID = parts[0]
	spanPart := parts[1]

	// Check for sampling flag
	if strings.Contains(spanPart, ";o=") {
		spanParts := strings.Split(spanPart, ";o=")
		spanID = spanParts[0]
		if len(spanParts) > 1 {
			sampled = spanParts[1] == "1"
		}
	} else {
		spanID = spanPart
		sampled = true // Default to sampled if not specified
	}

	return traceID, spanID, sampled
}

func spanContextFromCloudTraceHeader(traceHeader string) (oteltrace.SpanContext, bool) {
	traceIDHex, spanIDDec, sampled := ExtractTraceContext(traceHeader)
	if traceIDHex == "" || spanIDDec == "" {
		return oteltrace.SpanContext{}, false
	}

	traceIDBytes, err := hex.DecodeString(traceIDHex)
	if err != nil || len(traceIDBytes) != 16 {
		return oteltrace.SpanContext{}, false
	}
	var tid oteltrace.TraceID
	copy(tid[:], traceIDBytes)

	spanIDUint, err := strconv.ParseUint(spanIDDec, 10, 64)
	if err != nil {
		return oteltrace.SpanContext{}, false
	}
	var sid oteltrace.SpanID
	binary.BigEndian.PutUint64(sid[:], spanIDUint)

	var tf oteltrace.TraceFlags
	if sampled {
		tf = oteltrace.FlagsSampled
	}

	sc := oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: tf,
		Remote:     true,
	})
	if !sc.IsValid() {
		return oteltrace.SpanContext{}, false
	}
	return sc, true
}

// StartSpanFromHeader starts a server span using X-Cloud-Trace-Context as parent (if present).
func (c *Client) StartSpanFromHeader(ctx context.Context, traceHeader, spanName string) (context.Context, oteltrace.Span) {
	if sc, ok := spanContextFromCloudTraceHeader(traceHeader); ok {
		ctx = oteltrace.ContextWithSpanContext(ctx, sc)
	}
	return c.tracer.Start(ctx, spanName)
}

// Span wraps oteltrace.Span with an End method for convenience
type Span struct {
	oteltrace.Span
}

// End ends the span
func (s *Span) End() {
	if s.Span != nil {
		s.Span.End()
	}
}

// New creates a new span from context, following the spec's API pattern:
//   ctx, span := trace.New(ctx, "database::SomeFetchMethod")
//   defer span.End()
//
// The returned context contains the span, so hierarchical spans can be created.
func New(ctx context.Context, name string) (context.Context, *Span) {
	client := FromContext(ctx)
	if client == nil {
		// Graceful degradation: return context without span
		return ctx, &Span{}
	}

	spanCtx, otelSpan := client.StartSpan(ctx, name)
	return spanCtx, &Span{Span: otelSpan}
}

// SafeSpan wraps span operations with error handling
// It retrieves the tracer from context if not provided
func SafeSpan(ctx context.Context, client *Client, spanName string, fn func(context.Context) error) error {
	if client == nil {
		// Try to get tracer from context
		client = FromContext(ctx)
	}

	if client == nil {
		// Graceful degradation: continue without tracing
		log.Printf("Warning: trace client is nil, continuing without tracing for %s", spanName)
		return fn(ctx)
	}

	spanCtx, span := client.StartSpan(ctx, spanName)
	defer func() {
		span.End()
	}()

	return fn(spanCtx)
}
