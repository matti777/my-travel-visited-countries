# Backend: local build, test, and deploy to Cloud Run (Artifact Registry).
# Run targets from this directory (same context as Dockerfile).

BINARY := bin/backend
MAIN := ./cmd/backend

GCP_PROJECT_ID := my-travel--visited-countries
REGION ?= europe-north1
SERVICE_NAME ?= my-countries-backend
REPO_NAME := backend-repo
IMAGE_TAG := $(REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/$(REPO_NAME)/backend:latest

# Repo root is parent of this directory; frontend build copies into backend/static.
FRONTEND_DIR := ../frontend

.PHONY: list build test vet clean deploy

list:
	@grep '^[^#[:space:]].*:' Makefile

build:
	go build -o $(BINARY) $(MAIN)

test:
	go test ./...

vet:
	go vet ./...

clean:
	go clean
	rm -f bin/*

deploy:
	@set -e; \
	echo "Using project: $(GCP_PROJECT_ID), region: $(REGION), service: $(SERVICE_NAME)"; \
	echo "Creating Artifact Registry repository (if not exists)..."; \
	gcloud artifacts repositories describe "$(REPO_NAME)" \
		--location="$(REGION)" \
		--project="$(GCP_PROJECT_ID)" >/dev/null 2>&1 || \
	gcloud artifacts repositories create "$(REPO_NAME)" \
		--repository-format=docker \
		--location="$(REGION)" \
		--description="Backend container images" \
		--project="$(GCP_PROJECT_ID)"; \
	echo "Configuring Docker for Artifact Registry..."; \
	gcloud auth configure-docker "$(REGION)-docker.pkg.dev" --quiet; \
	echo "Building frontend and copying static files to backend..."; \
	(cd "$(FRONTEND_DIR)" && APP_PUBLIC_URL=https://countriesof.earth npm run build:and-copy); \
	echo "Building Docker image..."; \
	docker build -t "$(IMAGE_TAG)" .; \
	echo "Pushing image to Artifact Registry..."; \
	docker push "$(IMAGE_TAG)"; \
	gcloud run deploy "$(SERVICE_NAME)" \
		--image="$(IMAGE_TAG)" \
		--region="$(REGION)" \
		--project="$(GCP_PROJECT_ID)" \
		--platform=managed \
		--allow-unauthenticated \
		--set-env-vars="GOOGLE_CLOUD_PROJECT=$(GCP_PROJECT_ID)" \
		--timeout=300 \
		--min-instances=0 \
		--max-instances=1; \
	echo "Deployment complete."; \
