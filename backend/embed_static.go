package backend

import "embed"

// StaticFiles is the embedded frontend (static/index.html, static/assets/...).
//
//go:embed static
var StaticFiles embed.FS
