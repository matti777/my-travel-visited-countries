# Frontend module

This is the web frontend module for our app. It is intended to be built into minimal distribution using Vite. The resulting static files are to be served by the backend application (see @backend-module.md).

## Module Structure

The frontend application shall follow this structure:

- `spec/`: Specifications (markdown and any other files use to document the app)
- `css/`: All CSS files go here
- `src/`: All source files go here.
- `src/components/`: All 'component' source files go here, with a subdirectory + index.ts per component.

## Additional static assets

Thumbnail sized (no more than a couple of kilobytes each) flags for all the sovereign countries in the world are to be downloaded and stored as JPEG files under `frontend/assets/images/`. The files must be named <country-code>.jpg where `country-code` is the equivalent 2-letter ISO 3166-1 alpha-2 code for the corresponding country, in lower case. These images are to be built into the app bundle so that they can be readily accessed by the client without further download requests.

## Tech Stack

- **Language and frameworks:** Pure Typescript is used to build the application, with no frameworks such as React or Vue. This is to keep app size to a minimum and readability to a maximum.
- **Packaging:** Vite is to be used as the tool for building distributions of the app. Vite shall also be used to run the app in a development server. Then the application is built, the build arfifacts should be placed under `dist/` as well as copied to the backend module's directory `backend/static` from where they can be included in a backend build / deployment.
- **Development server:** The development server shall redirect all REST calls to `localhost:8080` where it is assumed a local backend is being run.
- **Formatting:** Standard formatting rules for Typescript should be applied. All lines should end with a semicolon.
- **Components:** Frontend build shall be configured so that components in `src/components/xyz` can be imported with `import { foo } from Components/xyz`

## User Authentication

The application provides Login (or Log out, when logged in) buttons in the top right corner. Pressing Login provides the user with a Firebase Authentication screen where they can log in using the enabled authentication providers (just Google for now). When the user is logged in, their name + avatar image are displayed next to the Log out button. Pressing Log out shall take the proper steps of logging the user out of Firebase Authentication.

This authentication status is checked every time the app loads; if the user has a login session, the authentication token is recorded and stored into the global `api` instance provided by `api.ts`. The authentication token is to be kept in RAM only.

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
