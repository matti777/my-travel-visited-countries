# REST API

This document defines the REST API routes used by the application. The data models described by @data-models.md shall be used as message payloads.

All routes are currently **unauthenticated** (see @backend-module.md). Authentication will be introduced later.

## API routes

Each subsection describes a single API route. When an API route is added, a corresponding Vite proxy config must be added to facilitate local testing.

### List countries

GET /countries: Returns all the available countries as a list of Country objects. **Unauthenticated**.

### Login

POST /login: Frontend calls this right after login actions complete. Only called when user has initiated login by pressing the "Login" button and the login sequence towards Firebase Authentication has completed. The backend checks for existing user by that `UserID` and creates one if not found, allocating the `ShareToken` at the same time. ImageURL is extracted from the authentication token and stored on the User document (on creation). No other request shall read/write to User model to avoid unnecessary database access unless otherwise stated. The response is success-only (e.g. empty JSON body); the friends list is obtained via GET /friends. **Authenticated**

### List country visits for current user

GET /visits: Returns all the CountryVisit objects for the current user. The response shall contain the list of country visits as well as the user's `ShareToken` which is retrieved by reading the User object by the `UserID` from the auth token. **Authenticated**.

### Create country visit for current user

PUT /visits: Creates a new CountryVisit object for the current user. Request body must include `countryCode` and `visitedTime` (Unix seconds, required). `visitedTime` must be between 1900-01-01 and the current date (inclusive). Request body may include optional `mediaUrl` (string); when provided it must be a well-formed URL usable as a hyperlink (e.g. http or https). In this request the ID field is empty. If successful, the backend will respond with 201 Created and the response body shall contain the newly created CountryVisit, with its ID field populated. **Authenticated**.

### Delete country visit

DELETE /visits/<visit-id>: Deletes a CountryVisit. Users are only allowed to delete their own visits. **Authenticated**.

### List country visits for share token

GET /share/visits/<share-token>: Uses the share token to retrieve the country visits for a certain user with matching `ShareToken`. The response contains the visits as well as the user's name and image URL for UI purposes. **Unauthenticated**.

### List friends

GET /friends: Returns the list of Friend objects for the current user. Response body is a list of Friend objects in camelCase (e.g. `{ "friends": [ { "shareToken", "name", "imageUrl" }, ... ] }` as per the Friend model in @data-models.md). **Authenticated**.

### Add friend

POST /friends: Adds a new friend user by their `ShareToken` if such friend does not yet exist for the current user. The backend stores the friend user's `Name` and `ImageURL` (in addition to `ShareToken`) when creating the Friend. The request body contains `shareToken`, `name`, and `imageUrl`, e.g. obtained from an earlier call to the share endpoint (GET /share/visits). **Authenticated**.

### Delete friend

DELETE /friends/<share-token>: Deletes a friend user by their `ShareToken`, if such friend exists for current user. **Authenticated**.
