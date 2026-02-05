# Golang backend

This is a simple HTTP backend implemented in Golang.

The application will allow users to list the countries they have visited.

## Project Structure

Follow a flat, functional layout within `internal/`:

- `cmd/backend/main.go`: Entry point.
- `internal/server/`: HTTP handlers and routing.
- `internal/database/`: Database schema and generated queries.
- `internal/models/`: Plain Go structs for data.

## Tech Stack

- **Deployment:** Intended deployment is to GCP offering such as AppEngine or Cloud Run.
- **Framework:** Use gin for HTTP framework
- **Context:** Pass context.Context into functions as first argument. Implement custom key type (typealias for string) and keys to place / retrieve data into a Context.
- **Database:** Firestore as its database. Firestore should always be accessed using the default Google access credentials available in the environment.

## Tracing

Enable tracing for GCP Cloud Trace API and include trace calls for all main function calls. Pass the tracer instance into functions via context.Context. The tracing should be usable in the following fashion:
`	ctx, span := trace.New(ctx, "database::SomeFetchMethod")
	defer span.End()
   `
Meaning the returned context should include the created span so that hierarchial spans can be created by the next New() call. In local (debug) environment every trace should be sampled, while in cloud deployment only one in ten should be sampled.

Should initializing the tracer fail, the program should exit with an error message.

## Logging

Write structured logs into STDOUT. Each log entry must be a single line of serialized JSON as understood by the GCP structured log parser. Create a Logger struct that can be instantiated safely and effectively and has methods for debug(), info(), warn(), error() and those methods should generate a proper `severity` key into the JSON generated.

The explicit Logger instance returned by NewLogger() / FromContext() shall be used everywhere; no package level calls that extract the logger from context first are needed. Functions should begin with something like:

```
log := logging.FromContext(ctx)
log.Debug("FunctionName()")
```

The logger is inserted into context at the earliest phase (startup in main, then per request in middleware), so it is always present during request processing. Nil checks on the logger from context are not required.

Should initializing the logger fail, the program should exit with an error message.

The Logger should have API like for example:

```
log.Debug("Log message", param1Name, param1Value, param2Name, param2Value)
```

and:

```
log, ctx = log.WithParams(param1Name, param1Value, param2Name, param2Value) // Creates new log & ctx instance. the new log instance will remember the param name-value pairs for future log calls and the new ctx instance will contain the newly created log instance.
```

The `logging` package should have a file listing all the used parameter names as string constants.

The Logger must connect each logging message to the originating request trace span by parsing the Traceparent header in the request (found in Context). A middleware must be set up to parse & inject the Traceparent header before any other logging operations need it. Should the header not been injected, the logger should ignore connecting logs to the request. This is for use cases when logging is output outside of a request context - for example when application is initializing.

Logger should check request context for `current_user` object and log its ID (as `current_user_id` logging param) in every logging call, if present.

## Database / API models

Use model definitions in @data-models.md.

## REST API

Use REST API route definitions in @api.md.

## GCP Authentication

For all GCP related authentication (eg. for Firestore, traces etc) assume to use Google's default authentication from the environment instead of explicit credentials.

## REST API Authentication

User authentication will be handled using Firebase Authentication.

1. All **Authenticated** routes in @api.md need to be authenticated. The authenticator should be a Golang type which caches the fetched token validation keys from Firebase for an hour at a time to improve performance by avoiding unnecesary refetches. The authentication should be handled by a Gin middleware. The middleware will inject a User object into the request Context using a dedicated context key `current_user`. The User object shall contain user ID, name and email as extracted from the token. A database object of the User shall be created if not exist (by ID) already.

2. The **Unauthenticated** routes shall not pass through this middleware.

## Initialization

At startup the app loads configuration from the environment:

- **Project ID:** At least one of `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT_ID` must be set; if neither is set, the app exits with an error.
- **Port:** The app listens on the port given by the `PORT` environment variable (default `8080`). Cloud Run sets `PORT` automatically.
- **Local vs cloud:** If `APP_ENV=debug` or no project ID is set, the app is treated as running locally (e.g. debug sampling for tracing). When running locally, GCP clients use [Google Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials); the operator must ensure credentials are available (e.g. set `GOOGLE_APPLICATION_CREDENTIALS` or run `gcloud auth application-default login`). The app may exit with a clear message if running locally and default credentials are not available.
- **Logging:** The app shall log the port it is listening on at startup.

### Bundled data

The application contains a Go slice (array) of `Country` objects representing every sovereign country on earth. The data format corresponds to the Country model defined in @data-models.md (CountryCode, Name, RegionCode). This slice is defined in source code and is returned when the `GET /countries` endpoint is called. Responses should be aggressively cached in any edge caches.

## Deployment

The backend is deployed to **GCP Cloud Run** as a container. The following must be available and documented:

- **Dockerfile:** Multi-stage build that compiles the Go binary in a build stage (e.g. Alpine-based) and runs it in a minimal run stage. The run stage uses a `scratch` base image with the root CA bundle copied from the build stage so the app can verify TLS (e.g. Firestore, Cloud Trace). The final image must listen on the port given by the `PORT` environment variable (Cloud Run sets this automatically).
- **Deployment steps:** All steps required to deploy to Cloud Run must be documented (in this spec, in README, or in a dedicated deployment doc). The steps are listed in the following subsection.

### Deployment steps (GCP Cloud Run)

1. **Prerequisites**
   - Create or select a GCP project and enable billing.
   - Install and initialize the gcloud CLI: `gcloud init`. Set default project: `gcloud config set project PROJECT_ID`.

2. **Enable APIs**
   - Cloud Run: `gcloud services enable run.googleapis.com`
   - Artifact Registry (recommended): `gcloud services enable artifactregistry.googleapis.com`
   - Firestore: `gcloud services enable firestore.googleapis.com`
   - Cloud Trace (optional): `gcloud services enable cloudtrace.googleapis.com`

3. **Firestore**
   - Create a Firestore database in the project (Native mode). Ensure collections `countries` and `country_visits` exist or will be created on first write. Create any composite indexes required by the app’s queries.

4. **Build and push the image**
   - From the backend directory, build and push (Artifact Registry example; create the repo first if needed):
     - `gcloud artifacts repositories create REPO_NAME --repository-format=docker --location=REGION`
     - `gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME/backend:latest .`
   - Alternatively use Container Registry: `gcloud builds submit --tag gcr.io/PROJECT_ID/backend:latest .`

5. **Deploy to Cloud Run**
   - Deploy: `gcloud run deploy SERVICE_NAME --image REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME/backend:latest --region REGION --platform managed --allow-unauthenticated`
   - Set environment variables for the service (e.g. `GOOGLE_CLOUD_PROJECT=PROJECT_ID`). Do not set `GOOGLE_APPLICATION_CREDENTIALS`; Cloud Run uses the service account identity. Leave `PORT` unset (Cloud Run sets it).

6. **IAM**
   - Grant the Cloud Run service account (default or the one specified) at least: Firestore (`roles/datastore.user`) and, if using tracing, Cloud Trace (`roles/cloudtrace.agent`). Example: `gcloud run services add-iam-policy-binding SERVICE_NAME --region=REGION --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/datastore.user"`

7. **Verify**
   - Open the Cloud Run service URL and call app endpoints (e.g. `GET /countries`, `GET /visits?user_id=test`).
