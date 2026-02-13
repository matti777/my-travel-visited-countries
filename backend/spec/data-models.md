# Data models

This document describes our data models, used for both the backend and the frontend as well as the API.

## Field naming

For database (Firestore), all field names should read as stated in this document, eg. `UserID`. For REST API, the field names should be in camelCase, eg. `userId`.

## ID fields

Any `ID` fields in Firestore models are allocated by the database unless stated otherwise.

## List of data models

Each subsection describes a single data model. Code for each model is to be put to a separate source code file.

For Firestore purposes, each model should have its Firestore ID stored in the object. This ID should not be sent over the REST interface.

### User model

Represents a system user. Data parsed from incoming authentication token. Only used in the backend.

- `ID`: Use the User ID from the authentication token for this value for faster access.
- `ShareToken`: A random UUID string generated at user creation
- `Name`: User name from the auth token
- `Email`: User email from the auth token
- `ImageURL`: User's image URL; extracted from the authentication token and stored at login (on user creation).

### Country model

- `CountryCode`: 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
- `Name`: Full name of the country
- `RegionCode`: Identifies the region using a 2-letter ISO 3166-1 Continent Code

**Validation:** `CountryCode` should be a valid ISO 3166-1 alpha-2 code. `RegionCode` should be a valid continent code.

### CountryVisit model

- `ID`: Database object ID, populated automatically when loading object.
- `CountryCode`: 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
- `VisitTime`: Time of the visit. Timestamp. Mandatory.
- `MediaURL`: Media URL to photos etc. related to the visit. Optional.

The CountryVisit collection in Firestore shall be nested under the corresponding User object.

**Validation:** `CountryCode` should be a valid ISO 3166-1 alpha-2 code. `VisitTime` must be between Jan 1, 1900 and the current date. `MediaURL` must be a well-formed URL that can be used as a hyperlink on a web page.

### Friend model

Friend models represent other users in the system that have been added to a user as friends. They will be connected using the added friend's `ShareToken`. Friend objects should be stored in `friends` collection under the User.

- `ID`: Database object ID, populated automatically when loading object.
- `ShareToken`: ShareToken of the friend user
- `Name`: Name of the friend user; duplicated here for faster access.
- `ImageURL`: Image URL of the friend user; duplicated here for faster access and set when the friend is created (e.g. from the share endpoint response or from the User document looked up by ShareToken).
