package logging

import (
	"regexp"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
)

// W3C Trace Context format: {version}-{trace-id}-{span-id}-{trace-flags}
// Example: 00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01
var traceparentRe = regexp.MustCompile(`^([0-9a-fA-F]{2})-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$`)

// ParseTraceparent parses the W3C Trace Context Traceparent header.
// Returns nil if the header is missing or invalid. Sampled is true when flags == "01".
func ParseTraceparent(header string) *ctxkeys.TraceContext {
	if header == "" {
		return nil
	}
	matches := traceparentRe.FindStringSubmatch(header)
	if len(matches) != 5 {
		return nil
	}
	_, traceID, spanID, flags := matches[1], matches[2], matches[3], matches[4]
	sampled := flags == "01"
	return &ctxkeys.TraceContext{TraceID: traceID, SpanID: spanID, Sampled: sampled}
}
