# REST API

This document defines the REST API routes used by the application. The data models described by @data-models.md shall be used as message payloads.

All routes are currently **unauthenticated** (see @backend-module.md). Authentication will be introduced later.

## API routes

Each subsection describes a single API route. When an API route is added, a corresponding Vite proxy config must be added to facilitate local testing.

### List countries

GET /countries: Returns all the available countries as a list of Country objects. **Unauthenticated**.

### Login

POST /login: Frontend calls this right after login actions complete. Only called when user has initiated login by pressing the "Login" button and the login sequence towards Firebase Authentication has completed. The backend checks for existing user by that `UserID` and creates one if not found, allocating the `ShareToken` at the same time. No other request shall read/write to User model to avoid unnecessary database access unless otherwise stated. **Authenticated**

### List country visits for current user

GET /visits: Returns all the CountryVisit objects for the current user. The response shall contain the list of country visits as well as the user's `ShareToken` which is retrieved by reading the User object by the `UserID` from the auth token. **Authenticated**.

### Create country visit for current user

PUT /visits: Creates a new CountryVisit object for the current user. Request body must include `countryCode` and `visitedTime` (Unix seconds, required). `visitedTime` must be between 1900-01-01 and the current date (inclusive). Request body may include optional `mediaUrl` (string); when provided it must be a well-formed URL usable as a hyperlink (e.g. http or https). In this request the ID field is empty. If successful, the backend will respond with 201 Created and the response body shall contain the newly created CountryVisit, with its ID field populated. **Authenticated**.

### Delete country visit

DELETE /visits/<visit-id>: Deletes a CountryVisit. Users are only allowed to delete their own visits. **Authenticated**.

### List country visits for share token

GET /share/visits/<share-token>: Uses the share token to retrieve the country visits for a certain user with matching `ShareToken`. The response contains both the visits as well as the user's name for UI purposes. **Unauthenticated**.
