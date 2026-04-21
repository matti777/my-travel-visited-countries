# Frontend resources (not the web app bundle)

This tree holds files that **support building or maintaining** the frontend but are **not** shipped as arbitrary static files from here (fonts and SVG sources are consumed by Node scripts; outputs go to `assets/images/`, `public/`, etc.).

The live app loads **Dancing Script** from Google Fonts in [`index.html`](../index.html). The TTF under `fonts/` is only for local OG image generation.

## Contents

- **`fonts/DancingScript-wght.ttf`** — Official variable font from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/dancingscript) (SIL Open Font License 1.1). Used only by [`scripts/generate-og-preview.mjs`](../scripts/generate-og-preview.mjs) when rasterizing the Open Graph preview title with **resvg**.

- **`sun-favicon.svg`** — Cartoon sun artwork for favicons. Source for [`scripts/generate-favicon.mjs`](../scripts/generate-favicon.mjs), which writes PNGs and copies the SVG into `public/` for deployment.

Regenerate after changes:

```bash
cd frontend && npm run generate-og-preview
cd frontend && npm run generate-favicon
```
