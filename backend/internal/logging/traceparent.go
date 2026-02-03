package logging

import (
	"strings"

	"github.com/matti777/my-countries/backend/internal/ctxkeys"
)

// ParseTraceparent parses the W3C Trace Context Traceparent header.
// Format: version-traceId-spanId-flags (e.g. 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01)
// Returns nil if the header is missing or invalid.
func ParseTraceparent(header string) *ctxkeys.TraceContext {
	if header == "" {
		return nil
	}
	parts := strings.Split(header, "-")
	if len(parts) != 4 {
		return nil
	}
	version, traceID, spanID := parts[0], parts[1], parts[2]
	if len(version) != 2 || len(traceID) != 32 || len(spanID) != 16 {
		return nil
	}
	// Basic hex check
	if !isHex(traceID) || !isHex(spanID) || !isHex(version) {
		return nil
	}
	return &ctxkeys.TraceContext{TraceID: traceID, SpanID: spanID}
}

func isHex(s string) bool {
	for _, r := range s {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') && (r < 'A' || r > 'F') {
			return false
		}
	}
	return true
}
