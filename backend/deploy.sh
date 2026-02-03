#!/usr/bin/env bash
# Deploy backend to GCP Cloud Run.
# Requires: gcloud CLI, GCP_PROJECT_ID (or will prompt for it).

set -e

if [ -z "${GCP_PROJECT_ID}" ]; then
  echo "GCP_PROJECT_ID is not set."
  read -rp "Enter GCP_PROJECT_ID: " GCP_PROJECT_ID
  if [ -z "${GCP_PROJECT_ID}" ]; then
    echo "GCP_PROJECT_ID is required. Aborting."
    exit 1
  fi
  export GCP_PROJECT_ID
fi

REGION="${GCP_REGION:-europe-north1}"
SERVICE_NAME="${GCP_CLOUD_RUN_SERVICE:-my-countries-backend}"
REPO_NAME="backend-repo"
IMAGE_TAG="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPO_NAME}/backend:latest"

# Run from backend directory (where Dockerfile and . are for build)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Using project: ${GCP_PROJECT_ID}, region: ${REGION}, service: ${SERVICE_NAME}"
gcloud config set project "$GCP_PROJECT_ID"

echo "Creating Artifact Registry repository (if not exists)..."
gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null || \
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Backend container images"

echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "Building Docker image..."
docker build -t "$IMAGE_TAG" .

echo "Pushing image to Artifact Registry..."
docker push "$IMAGE_TAG"

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID}" \
  --timeout=300

echo "Deployment complete."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')
echo "Service URL: ${SERVICE_URL}"
echo "Verify: curl -s ${SERVICE_URL}/countries"
echo "Verify: curl -s \"${SERVICE_URL}/visits?user_id=test\""
