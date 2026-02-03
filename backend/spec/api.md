# REST API

This document defines the REST API routes used by the application. The data models described by @data-models.md shall be used as message payloads.

All routes are currently **unauthenticated** (see @backend-module.md). Authentication will be introduced later.

## API routes

Each subsection describes a single API route.

### List countries

GET /countries: Returns all the available countries as a list of Country objects.

### List country visits for current user

GET /visits: Returns all the CountryVisit objects for the current user.

### Create country visit for current user

PUT /visits: Creates a new CountryVisit object for the current user.
