# REST API

This document defines the REST API routes used by the application. The data models described by @data-models.md shall be used as message payloads.

Each route below is labeled **Authenticated** or **Unauthenticated**. **Authenticated** routes require a valid Firebase ID token unless stated otherwise in @backend-module.md.

When ever there is an array being returned and it has no values, it should return an empty array instead of null.

## API routes

Each subsection describes a single API route. When an API route is added, a corresponding Vite proxy config must be added to facilitate local testing.

### List countries

GET /countries: Returns all the available countries as a list of Country objects. **Unauthenticated**.

### Login

POST /login: Frontend calls this right after login actions complete. Only called when user has initiated login by pressing the "Login" button and the login sequence towards Firebase Authentication has completed. The backend checks for existing user by that `UserID` and creates one if not found, allocating the `ShareToken` at the same time and default user `Settings` (sharing flags true). ImageURL is extracted from the authentication token and stored on the User document (on creation). No other request shall read/write to User model to avoid unnecessary database access unless otherwise stated (exceptions: GET /visits for ShareToken; GET/PUT /settings; GET /share/profile reads Settings for filtering and public profile fields). The response is success-only (e.g. empty JSON body); the friends list is obtained via GET /friends. **Authenticated**

### List country visits for current user

GET /visits: Returns all the CountryVisit objects for the current user (`countryCode`, `visitedTime`, optional `mediaUrl`, optional `notes`, `tags`, `id`). Each CountryVisit includes `tags` as an array of strings (empty array if none). Tag strings are lowercase ASCII letters `[a-z]` only, at least **2** characters per tag (see data-models.md). Optional `notes` is a free-form string of at most **1000** characters (omitted when empty). The response shall contain the list of country visits as well as the user's `ShareToken` which is retrieved by reading the User object by the `UserID` from the auth token. **Authenticated**.

### Create country visit

POST /visits: Creates a new CountryVisit object for the current user. Request body must include `countryCode` and `visitedTime` (Unix seconds, required). `visitedTime` must be between 1900-01-01 and the current date (inclusive). Request body may include optional `mediaUrl` (string); when provided it must be a well-formed URL usable as a hyperlink (e.g. http or https). Request body may include optional `notes` (string, at most **1000** characters). Request body may include optional `tags`, an array of strings: at most **10** tags per visit; each tag must match `[a-z]{2,}` (at least two letters). Duplicate values in `tags` are deduplicated server-side before validation (first occurrence wins). In this request the ID field is empty. If successful, the backend will respond with 201 Created and the response body shall contain the newly created CountryVisit, with its ID field populated and `tags` reflecting what was stored. **Authenticated**.

### Update country visit

PUT /visits/<visit-id>: Updates an existing CountryVisit for the current user. **Authenticated**. Only the owner's visit may be updated; `countryCode` is not part of the request (it is fixed at creation; use a new visit for a different country).

The body is a **partial** JSON object: any combination of `visitedTime` (Unix seconds), `tags`, `mediaUrl`, and `notes`. **Omitted** fields keep their existing stored values (omission does not clear a field). When `visitedTime` is present, it must be between 1900-01-01 and the current date (inclusive), same as create. When `tags` is present, the same rules apply as in "Create country visit" (deduplication server-side before validation, at most **10** tags, each matching `[a-z]{2,}`). When `mediaUrl` is present and non-empty, it must be a well-formed URL (e.g. http or https). When `notes` is present, it must be at most **1000** characters; an empty string clears stored notes. Validation failures yield **400 Bad Request**. On success, **200 OK** with the full **CountryVisit** in the body (`id`, `countryCode`, `visitedTime`, `tags`, `mediaUrl`, `notes`). If the visit does not exist or does not belong to the current user, respond with **404 Not Found** (same status in both cases).

### Delete country visit

DELETE /visits/<visit-id>: Deletes a CountryVisit. Users are only allowed to delete their own visits. **Authenticated**.

### Get shared profile

GET /share/profile/<share-token>: Uses the share token to retrieve the public profile and country visits for the user with matching `ShareToken`. Response type is **ShareProfileResponse**: `visits`, `userName`, optional `imageUrl`, optional `homeCountryCode`, optional `instagramUserName`, optional `description` (omit keys when unset). CountryVisit objects include `tags` as for GET /visits. When the owner's Settings.Sharing.ShareMediaURL is false, `mediaUrl` is omitted/cleared on each visit; when ShareNotes is false, `notes` is omitted/cleared; when ShareTags is false, `tags` is an empty array. Missing Settings defaults all three flags to true. **Unauthenticated**.

### Get user settings

GET /settings: Returns the current user's settings only (auth `UserID`). Response body includes `sharing` (`shareMediaUrl`, `shareNotes`, `shareTags`) and optional `homeCountryCode` / `instagramUserName` / `description` (omit when unset). If the User document has no `Settings`, sharing flags default to **true**. A missing `ShareTags` key on an existing Settings object also defaults to **true**. **Authenticated**.

### Update user settings

PUT /settings: Replaces the current user's settings. Request body must include all three booleans under `sharing` (`shareMediaUrl`, `shareNotes`, `shareTags`). Optional `homeCountryCode`, `instagramUserName`, and `description`: include the key only when setting a non-empty value; **omit the key entirely to clear/unset** that field (do not send empty strings). Present `homeCountryCode` must be a listed country code; present `instagramUserName` must match the Instagram username format in [data-models.md](data-models.md) (leading `@` is stripped); present `description` must be at most **1000** characters. Writes only to the authenticated user's User document. On success **200 OK** with the stored settings (omit unset optional keys). **400** if the body is invalid or any sharing boolean is omitted. Field-level validation failures use **ValidationErrors**: `{ "error": "validation failed", "fields": { "<camelCaseField>": "<message>" } }`. **404** if the user document is missing (complete login first). **Authenticated**.

### List friends

GET /friends: Returns the list of Friend objects for the current user. Response body is a list of Friend objects in camelCase (e.g. `{ "friends": [ { "shareToken", "name", "imageUrl" }, ... ] }` as per the Friend model in @data-models.md). **Authenticated**.

### Add friend

POST /friends: Adds a new friend user by their `ShareToken` if such friend does not yet exist for the current user. The backend stores the friend user's `Name` and `ImageURL` (in addition to `ShareToken`) when creating the Friend. The request body contains `shareToken`, `name`, and `imageUrl`, e.g. obtained from an earlier call to the share profile endpoint (GET /share/profile). **Authenticated**.

### Delete friend

DELETE /friends/<share-token>: Deletes a friend user by their `ShareToken`, if such friend exists for current user. **Authenticated**.

