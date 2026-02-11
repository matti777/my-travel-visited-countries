# My Travel: Visited Countries

A web app for tracking which countries you have visited. You can view your list (alphabetical, by continent, or on a map), add visits with optional media, and share a read-only list via a link.

## Tech overview

- **Frontend:** TypeScript, Vite, Firebase Auth. Dev server on port 5173; proxies API requests to the backend.
- **Backend:** Go (Gin), Firestore, GCP Cloud Run. Serves the REST API and can serve the built frontend.

## Frontend

The frontend lives in `frontend/`. Run and build instructions are in its own README.

See [frontend/README.md](frontend/README.md).

## Backend

The backend lives in `backend/`. Setup, running locally, and deployment are documented in its own README.

See [backend/README.md](backend/README.md).

## License

This project is under the MIT License. See [LICENSE.md](LICENSE.md).

## Contact

[mdahlbom666@gmail.com](mailto:mdahlbom666@gmail.com)
