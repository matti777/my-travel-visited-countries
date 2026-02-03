#!/usr/bin/env bash
# Apply Artifact Registry cleanup policy: keep 5 latest versions per package.
# Requires: gcloud CLI, GCP_PROJECT_ID (or will prompt for it).
# Usage: ./set-artifact-cleanup-policy.sh [--dry-run]

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
REPO_NAME="backend-repo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${SCRIPT_DIR}/artifact-registry-cleanup-policy.json"

if [ ! -f "$POLICY_FILE" ]; then
  echo "Policy file not found: $POLICY_FILE"
  exit 1
fi

DRY_RUN="--no-dry-run"
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
  echo "Dry run: no artifacts will be deleted."
fi

echo "Using project: ${GCP_PROJECT_ID}, region: ${REGION}, repo: ${REPO_NAME}"
gcloud config set project "$GCP_PROJECT_ID"

gcloud artifacts repositories set-cleanup-policies "$REPO_NAME" \
  --project="$GCP_PROJECT_ID" \
  --location="$REGION" \
  --policy="$POLICY_FILE" \
  $DRY_RUN

echo "Cleanup policy applied. Changes take effect within ~1 day."
