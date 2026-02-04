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
