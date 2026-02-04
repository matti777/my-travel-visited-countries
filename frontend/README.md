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
