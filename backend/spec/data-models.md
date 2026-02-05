# Data models

This document describes our data models, used for both the backend and the frontend as well as the API.

## List of data models

Each subsection describes a single data model. Code for each model is to be put to a separate source code file.

For Firestore purposes, each model should have its Firestore ID stored in the object. This ID should not be sent over the REST interface.

### User model

Represents a system user. Data parsed from incoming authentication token. Only used in the backend.

- `ID`: User ID from the token
- `Name`: User name from the token
- `Email`: User email from the token

### Country model

- `CountryCode`: 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
- `Name`: Full name of the country
- `RegionCode`: Identifies the region using a 2-letter ISO 3166-1 Continent Code

**Validation:** CountryCode should be a valid ISO 3166-1 alpha-2 code. RegionCode should be a valid continent code.

### CountryVisit model

- `CountryCode`: 2-letter ISO 3166-1 alpha-2 code depicting the country visited. Mandatory.
- `VisitedTime`: Time of the visit. Timestamp. Optional.
- `UserID`: ID of the user who created this object.

**Validation:** CountryCode should be a valid ISO 3166-1 alpha-2 code.
