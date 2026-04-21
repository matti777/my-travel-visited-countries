# Repository resources (not the web app bundle)

This tree holds files that **support building or maintaining the project** but are **not** part of the static frontend that ships to browsers.

The live app loads **Dancing Script** from Google Fonts in [`frontend/index.html`](../frontend/index.html). Nothing under `resources/` is copied into `frontend/dist/` or embedded in the backend binary by default.

## `fonts/`

- **`DancingScript-wght.ttf`** — Official variable font from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/dancingscript) (SIL Open Font License 1.1). Used only by [`frontend/scripts/generate-og-preview.mjs`](../frontend/scripts/generate-og-preview.mjs) when rasterizing the Open Graph preview title with **resvg**, so the OG image matches the app’s typeface. Keeping it here avoids placing a build-only font next to [`frontend/assets/images/`](../frontend/assets/images/), which *is* bundled for the client.

Regenerate the preview image after font or layout changes:

```bash
cd frontend && npm run generate-og-preview
```
