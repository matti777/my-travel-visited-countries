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

.PHONY: list build test vet clean check-deploy-prereqs deploy

list:
	@echo "Backend Makefile targets (run from backend/):"
	@echo "  list    - print this help"
	@echo "  build   - compile the Go server binary to $(BINARY)"
	@echo "  test    - run go test ./..."
	@echo "  vet     - run go vet ./..."
	@echo "  clean   - run go clean and remove files under bin/"
	@echo "  deploy  - build frontend, docker image, push to Artifact Registry, deploy to Cloud Run"

build:
	go build -o $(BINARY) $(MAIN)

test:
	go test ./...

vet:
	go vet ./...

clean:
	go clean
	rm -f bin/*

# Abort early if Docker/gcloud are missing or the active account lacks deploy access.
check-deploy-prereqs:
	@set -e; \
	if ! command -v docker >/dev/null 2>&1; then \
		echo "error: docker is not installed (or not on PATH)."; \
		echo "Install Docker Desktop / Docker Engine, then retry."; \
		exit 1; \
	fi; \
	if ! docker info >/dev/null 2>&1; then \
		echo "error: docker daemon is not running."; \
		echo "Start Docker Desktop (or the docker service) and retry."; \
		exit 1; \
	fi; \
	if ! command -v gcloud >/dev/null 2>&1; then \
		echo "error: gcloud CLI is not installed (or not on PATH)."; \
		echo "Install: https://cloud.google.com/sdk/docs/install"; \
		exit 1; \
	fi; \
	GCLOUD_ACCOUNT=$$(gcloud auth list --filter=status:ACTIVE \
		--format='value(account)' 2>/dev/null | head -n1); \
	if [ -z "$$GCLOUD_ACCOUNT" ]; then \
		echo "error: no active gcloud account."; \
		echo "Log in with: gcloud auth login"; \
		exit 1; \
	fi; \
	echo "gcloud account: $$GCLOUD_ACCOUNT"; \
	fail_gcloud_access() { \
		echo "error: $$*"; \
		echo "Switch user (current: $$GCLOUD_ACCOUNT):"; \
		echo "  gcloud auth login"; \
		echo "  gcloud config set account YOUR_EMAIL"; \
		echo "  gcloud auth list"; \
		echo "Or ask a project owner to grant Artifact Registry Writer" \
			"and Cloud Run Admin on '$(GCP_PROJECT_ID)'."; \
		exit 1; \
	}; \
	if ! gcloud projects describe "$(GCP_PROJECT_ID)" >/dev/null 2>&1; then \
		fail_gcloud_access "account '$$GCLOUD_ACCOUNT' cannot access" \
			"project '$(GCP_PROJECT_ID)'."; \
	fi; \
	if ! gcloud artifacts repositories list \
		--project="$(GCP_PROJECT_ID)" \
		--location="$(REGION)" \
		--limit=1 >/dev/null 2>&1; then \
		fail_gcloud_access "account '$$GCLOUD_ACCOUNT' cannot access" \
			"Artifact Registry in project '$(GCP_PROJECT_ID)'" \
			"(region $(REGION)); image upload would fail."; \
	fi; \
	if ! gcloud run services list \
		--project="$(GCP_PROJECT_ID)" \
		--region="$(REGION)" \
		--limit=1 >/dev/null 2>&1; then \
		fail_gcloud_access "account '$$GCLOUD_ACCOUNT' cannot access" \
			"Cloud Run in project '$(GCP_PROJECT_ID)'" \
			"(region $(REGION)); service deploy would fail."; \
	fi

deploy: check-deploy-prereqs
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
	echo "Deployment complete."

