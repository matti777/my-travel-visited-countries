# Frontend module

This is the web frontend module for our app. It is intended to be built into minimal distribution using Vite. The resulting static files are to be served by the backend application (see @backend-module.md).

## Module Structure

The frontend application shall follow this structure:

- `spec/`: Specifications (markdown and any other files use to document the app)
- `css/`: All CSS files go here
- `src/`: All source files go here.
- `src/components/`: All 'component' source files go here, with a subdirectory + index.ts per component.

## Additional static assets

Thumbnail sized (no more than a couple of kilobytes each) flags are stored as JPEG files under `frontend/assets/images/` named `<country-code>.jpg` (`country-code` lowercase). Sovereign codes are listed in `scripts/country-codes.json` (aligned with `GET /countries`). Map-only territories that use their own flag file (not a parent’s, e.g. `eh`, `xk`, `ps`) are derived from **`src/map-regions.ts`** via **`MAP_ONLY_FLAG_ASSET_CODES_LOWER`**. Run `npm run download-flags` from the frontend directory (`tsx scripts/download-flag-assets.ts`) to fetch sovereign + map-only assets (deduplicated).

## Map-only regions (svgMap)

Some territories drawn by the world map library are **not** sovereign countries in `GET /countries`. Their labels, tooltip behavior, and optional ties to visit data are defined in **`src/map-regions.ts`** (`MAP_ONLY_REGIONS`). Initial entries:

| Map code | Display name          | Visits / statistics                                                                 |
| -------- | --------------------- | ------------------------------------------------------------------------------------- |
| `GL`     | Greenland (Denmark)   | Uses Denmark (`DK`) visits and coloring; tooltip flag is **`dk.jpg`** (no `gl` asset). |
| `XK`     | Kosovo                | Not a country in the app; tooltip only; flag **`xk.jpg`**.                           |
| `EH`     | Western Sahara        | Not a country in the app; tooltip only; flag **`eh.jpg`**.                           |
| `PS`     | Palestine             | Not a country in the app; tooltip only; flag **`ps.jpg`**.                           |
| `PR`     | Puerto Rico (USA)     | Uses **`US`** visits and fill; tooltip flag **`us.jpg`**.                            |
| `VI`     | Virgin Islands (USA) | Uses **`US`** visits and fill; tooltip flag **`us.jpg`**.                             |
| `VG`     | Virgin Islands (UK)   | Uses **`GB`** visits and fill; tooltip flag **`gb.jpg`**.                               |
| `MS`     | Montserrat (UK)       | Uses **`GB`** visits and fill; tooltip flag **`gb.jpg`**.                               |
| `GP`     | Guadeloupe (France)   | Uses **`FR`** visits and fill; tooltip flag **`fr.jpg`**.                               |
| `MQ`     | Martinique (France)   | Uses **`FR`** visits and fill; tooltip flag **`fr.jpg`**.                               |
| `GF`     | French Guyana (France) | Uses **`FR`** visits and fill; tooltip flag **`fr.jpg`**.                               |
| `NC`     | New Caledonia (France) | Uses **`FR`** visits and fill; tooltip flag **`fr.jpg`**.                               |

On the **Map** tab, disputed / non-listed territories without a parent visit source use **darker gray** than unvisited sovereign countries; territories that mirror a sovereign code use that code’s colors when visited, otherwise the same darker gray.

The **Statistics** tab counts **only** visits whose `countryCode` exists in the canonical country list from the backend. Map-only codes never appear as stored visit codes (visits attach to sovereign parents such as `DK`, `US`, `GB`, `FR`).

## Tech Stack

- **Language and frameworks:** Pure Typescript is used to build the application, with no frameworks such as React or Vue. This is to keep app size to a minimum and readability to a maximum.
- **Packaging:** Vite is to be used as the tool for building distributions of the app. Vite shall also be used to run the app in a development server. Then the application is built, the build arfifacts should be placed under `dist/` as well as copied to the backend module's directory `backend/static` from where they can be included in a backend build / deployment.
- **Development server:** The development server shall redirect all REST calls to `localhost:8080` where it is assumed a local backend is being run.
- **Formatting:** Standard formatting rules for Typescript should be applied. All lines should end with a semicolon.
- **Components:** Frontend build shall be configured so that components in `src/components/xyz` can be imported with `import { foo } from Components/xyz`

## User Authentication

The application provides Login (or Log out, when logged in) buttons in the top right corner. Pressing Login provides the user with a Firebase Authentication screen where they can log in using the enabled authentication providers (just Google for now). When the user is logged in, their name + avatar image are displayed next to the Log out button; clicking the name or avatar opens the [user settings dialog](user-settings-dialog.md). Pressing Log out shall take the proper steps of logging the user out of Firebase Authentication.

This authentication status is checked every time the app loads; if the user has a login session, the authentication token is recorded and stored into the global `api` instance provided by `api.ts`. The authentication token is to be kept in RAM only.

## Analytics

The app sends Firebase Analytics events about the most important actions:

- Login
- Logout (button press)
- Adding a country visit (fields: country code, year, month, day)
- Removing a country visit (fields: country code, year, month, day)
- Selecting a visualization tab to display
- Viewing media URL (fields: country code, year, month, day)
- Opening a shared URL (fields: share token)
- Adding a friend (fields: share token)
- Removing a friend (fields: share token)

## Error handling

All errors must be logged to console error log. All errors must by default show an errorToast() with a descriptive message.

## App logging

All major operations (network etc) should be logged to console log upon success (errors get logged via console errors) and a descriptive message should be displayed.

## App initialization

When the app starts, it checks the authentication status and then goes on to fetch a list of the countries from the backend (see @api.md). This list of countries shall be cached in the client for up to 7 days after which it will be invalidated from storage and refetched. This is to avoid unnecessary fetch operations for data that does not change often. Once the list of countries has been retrieved (from backend or local cache), it is stored in a variable held by `app.ts`.

## Backend API

For the backend API description, see @api.md.

## Data models

Implement Typescript types that adhere to the models defined in @data-models.md.

## User interface

The user interface for the application is defined in @user-interface.md.

Modal confirmation dialogs (`Components/modal`) use a full-screen overlay whose stacking order sits above the edit-mode floating “Done” hint so overlays block interaction with controls behind them, including that float (see @user-interface.md).
