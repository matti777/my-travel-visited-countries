# My Countries Backend

A simple HTTP backend implemented in Go for managing countries visited by users. Deployed to GCP Cloud Run with Firestore as the database.

## Tech Stack

- **Language:** Go 1.22+
- **Framework:** Gin
- **Database:** Firestore
- **Platform:** GCP Cloud Run

## Project Structure

```
backend/
├── cmd/backend/main.go           # Application entry point
├── internal/
│   ├── server/                  # HTTP handlers and routing
│   │   ├── server.go
│   │   ├── handlers.go
│   │   └── routes.go
│   ├── models/                  # Data models
│   │   └── country.go
│   ├── database/                # Firestore client and queries
│   │   ├── firestore.go
│   │   └── queries.go
│   └── config/                  # Configuration
│       └── config.go
├── spec/                        # Markdown specifications
│   └── backend-module.md
├── go.mod
├── app.yaml                     # App Engine configuration
└── README.md
```

## Setup

1. **Install dependencies:**

   ```bash
   cd backend
   go mod tidy
   ```

2. **Set up GCP credentials:**

   - Set `GOOGLE_CLOUD_PROJECT` environment variable to your GCP project ID
   - For local development, authenticate with: `gcloud auth application-default login`

3. **Configure Firestore:**
   - Create a Firestore database in your GCP project (Native mode)
   - The app uses collections `countries` (reference data: countryCode, name, regionCode) and `country_visits` (user visits: countryCode, visitedTime, userId)

## Running Locally

```bash
# Set your GCP project ID
export GOOGLE_CLOUD_PROJECT=your-project-id

# Run the server
go run ./cmd/backend
```

The server will start on port 8080 (or the port specified in the `PORT` environment variable).

## API Endpoints

### GET /countries

Returns all available countries (reference data from the `countries` collection).

### GET /visits

Returns country visits for the current user.

**Query Parameters:**

- `user_id` (string, required for now) - User ID to fetch countries for

**Query parameters:** `user_id` (required for now) – user ID to fetch visits for.

**Response:** `{ "visits": [ { "countryCode": "FI", "visitedTime": "...", "userId": "..." }, ... ] }`

**Note:** Authentication is not implemented yet. Pass `user_id` as a query parameter for testing.

## Deployment to Cloud Run

The backend runs as a container on GCP Cloud Run. The image is built with the included Dockerfile (multi-stage, scratch base with root CA certs). Follow these steps to deploy.

### 1. Prerequisites

- A GCP project with billing enabled.
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and logged in.

Set your project and region (use your own values):

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=europe-north1   # or us-central1, etc.
gcloud config set project $PROJECT_ID
```

### 2. Enable required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudtrace.googleapis.com
```

### 3. Firestore

In the [Firestore console](https://console.cloud.google.com/firestore) (or via gcloud), create a Firestore database in **Native mode** if you do not have one. The app uses collections `countries` (reference data) and `country_visits` (user visits); they can be created on first write.

### 4. Create Artifact Registry repository and build the image

Create a Docker repository (once per project/region):

```bash
gcloud artifacts repositories create backend-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="Backend container images"
```

Build and push the image from the backend directory:

```bash
cd backend
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/backend-repo/backend:latest .
```

### 5. Deploy to Cloud Run

Deploy the service (Cloud Run will set `PORT` automatically; do not set `GOOGLE_APPLICATION_CREDENTIALS`):

```bash
gcloud run deploy my-countries-backend \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/backend-repo/backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
```

Note the service URL printed when the deploy finishes.

### 6. Grant the service account access to Firestore and Trace

The container runs as the default Compute Engine service account. Grant it access to Firestore and (optionally) Cloud Trace at **project** level:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Firestore
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"

# Cloud Trace (optional)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtrace.agent"
```

If you deployed with a custom service account (`--service-account=...`), use that email instead of `SERVICE_ACCOUNT`.

### 7. Verify

Get the service URL and call the API:

```bash
SERVICE_URL=$(gcloud run services describe my-countries-backend --region=$REGION --format='value(status.url)')
curl -s "$SERVICE_URL/countries"
curl -s "$SERVICE_URL/visits?user_id=test"
```

## Development Notes

- The application follows Go best practices with dependency injection
- Database operations use context.Context for cancellation and timeouts
- Error handling follows Go conventions with error wrapping
- The server gracefully shuts down on SIGINT/SIGTERM signals
