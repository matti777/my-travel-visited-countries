# My Countries Frontend

Pure TypeScript frontend, built with Vite. See [spec/frontend-module.md](spec/frontend-module.md).

## Requirements

- Node.js >= 18. If you use nvm, run `nvm use 18` (or your preferred 18+ version) before installing or running scripts.

---

## a) Run the development server

1. **Install dependencies** (once per clone or after adding dependencies):

   ```bash
   cd frontend
   npm install
   ```

2. **Start the dev server:**

   ```bash
   npm run dev
   ```

3. Open **http://localhost:5173** in the browser. The app loads from the Vite dev server.

4. **Backend:** For API calls (e.g. `/countries`, `/visits`), run the backend on **http://localhost:8080**. The Vite config proxies those paths to the backend, so the frontend can use relative URLs like `fetch("/countries")`.

---

## b) Build the application for distribution

1. **Install dependencies** if needed:

   ```bash
   cd frontend
   npm install
   ```

2. **Build** (output in `dist/`):

   ```bash
   npm run build
   ```

   The production assets are in `frontend/dist/` (HTML, JS, CSS). Serve that folder with any static file server or the backend.

3. **Optional: build and copy into the backend** so the backend can serve the frontend:

   ```bash
   npm run build:and-copy
   ```

   This runs `vite build` then copies `dist/` to `backend/static/`. Deploy the backend with that `static/` content to serve the app.

4. **Open Graph (link previews):** `index.html` includes `og:*` and Twitter Card meta tags. Absolute URLs are filled in by `scripts/copy-to-backend.mjs`, which replaces `__APP_PUBLIC_URL__` with the environment variable **`APP_PUBLIC_URL`** (no trailing slash). If unset, it defaults to `https://countriesof.earth`. The **`backend/Makefile`** `deploy` target sets `APP_PUBLIC_URL=https://countriesof.earth` when it runs `npm run build:and-copy`. For a local preview URL, run `APP_PUBLIC_URL=http://localhost:8080 npm run build:and-copy` (or your dev origin) before testing.

5. **Preview image:** `assets/images/og-preview.jpg` (1200×630) is the image for `og:image` / `twitter:image`. The generator renders the title with **Dancing Script** using `resources/fonts/DancingScript-wght.ttf` (build-only font for OG rasterization; not shipped with the app—see [`resources/README.md`](resources/README.md)). Regenerate after changing polaroids, background, title styling, or layout:

   ```bash
   npm run generate-og-preview
   ```

6. **Validate** in [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and [Twitter Card Validator](https://cards-dev.twitter.com/validator). Telegram, WhatsApp, and others cache images; change the filename or add a query string on `og:image` if you replace the art and previews look stale.

### Search engine visibility (SEO)

- **`robots.txt` and `sitemap.xml`** live in `public/` with `__APP_PUBLIC_URL__` placeholders. `npm run build:and-copy` injects the same `APP_PUBLIC_URL` as for `index.html`, so production serves `https://<your-domain>/robots.txt` and `https://<your-domain>/sitemap.xml`.
- **`index.html`** includes a canonical URL, Open Graph / Twitter tags, and JSON-LD (`WebApplication`) for structured data. Validate with [Google Rich Results Test](https://search.google.com/test/rich-results).
- **Search Console and Bing:** After deploy, add the site in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit the sitemap URL (for example `https://countriesof.earth/sitemap.xml` when using the default public URL).
- **Performance:** Run [PageSpeed Insights](https://pagespeed.web.dev/) on the production URL to check Core Web Vitals (LCP, INP, CLS) and follow any high-impact suggestions.

---

## Flag assets

Thumbnail flag images (JPEG, one per sovereign country) are stored under `assets/images/` as `<country-code>.jpg` (lowercase ISO 3166-1 alpha-2). They are built into the app bundle so the client can load them without extra requests.

To download or refresh the images (from [flagcdn.com](https://flagcdn.com/)):

```bash
cd frontend
node scripts/download-flag-assets.mjs
```

The script reads the list of country codes from `scripts/country-codes.json`. That list is kept in sync with the backend’s sovereign country list.

---

## Adding new dependencies

To add a library (e.g. for toast notifications, UI, or utilities):

1. **Install the package:**

   ```bash
   cd frontend
   npm install notyf
   ```

   Use `npm install <package>` for runtime deps; use `npm install -D <package>` for dev-only tools (e.g. linters).

2. **Use it in your code:** Import and use the library in `src/` (e.g. in a component or `app.ts`):

   ```ts
   import { Notyf } from "notyf";
   import "notyf/notyf.min.css";

   const notyf = new Notyf();
   notyf.success("Saved");
   ```

3. **TypeScript types:** If the package has no types and you see type errors, install community types if they exist:

   ```bash
   npm install -D @types/notyf
   ```

   If no `@types` package exists, you can add a small `.d.ts` declaration in `src/` or use `// @ts-ignore` sparingly.

4. **CSS:** If the library ships CSS, import it from your TypeScript (as above) so Vite bundles it, or link it in `index.html` if you prefer.

5. **Re-run dev or build:** After adding dependencies, `npm run dev` and `npm run build` will include the new package automatically; no extra config is needed unless the library’s docs say otherwise.
