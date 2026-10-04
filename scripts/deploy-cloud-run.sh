#!/usr/bin/env bash
# Publish an already-built image to Cloud Run. Secrets come from the environment
# and are written to a temporary env file that this script deletes.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_RUNTIME_SERVICE_ACCOUNT:?Set GCP_RUNTIME_SERVICE_ACCOUNT}"
: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID}"
: "${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET}"
: "${AUTH_SECRET:?Set AUTH_SECRET}"
: "${GCS_BUCKET:?Set GCS_BUCKET}"
: "${AUTH_ADMIN_EMAILS:?Set AUTH_ADMIN_EMAILS}"
: "${IMAGE:?Set IMAGE to the pushed container image}"

REGION="${GCP_REGION:-us-central1}"
if [ -z "$REGION" ]; then REGION="us-central1"; fi
SERVICE="${CLOUD_RUN_SERVICE:-anywhere-strings-ota}"
ENV_FILE="$(mktemp)"
cleanup() { rm -f "$ENV_FILE"; }
trap cleanup EXIT

gcloud config set project "$GCP_PROJECT_ID" >/dev/null
if ! gcloud artifacts repositories describe publisher --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create publisher \
    --repository-format=docker \
    --location="$REGION" \
    --description="Anywhere String OTA" \
    --quiet
fi

GCP_PROJECT_ID="$GCP_PROJECT_ID" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import json
import os
from pathlib import Path

values = {
    "NODE_ENV": "production",
    "PUBLISHER_REPLICA": "gcs",
    "PUBLISHER_DATABASE_PATH": "/data/publisher.sqlite",
    "GCS_BUCKET": os.environ["GCS_BUCKET"],
    "AUTH_ADMIN_EMAILS": os.environ["AUTH_ADMIN_EMAILS"],
    "GOOGLE_CLIENT_ID": os.environ["GOOGLE_CLIENT_ID"],
    "GOOGLE_CLIENT_SECRET": os.environ["GOOGLE_CLIENT_SECRET"],
    "AUTH_SECRET": os.environ["AUTH_SECRET"],
    "GOOGLE_CLOUD_PROJECT": os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ["GCP_PROJECT_ID"],
}
lines = []
for key, value in values.items():
    if "\n" in value or "\r" in value:
        raise SystemExit(f"{key} must be a single line.")
    lines.append(f"{key}: {json.dumps(value)}")
Path(os.environ["ENV_FILE"]).write_text("\n".join(lines) + "\n")
PY

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 1 \
  --concurrency 20 \
  --service-account "$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --env-vars-file "$ENV_FILE" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --update-env-vars "AUTH_URL=${URL}" \
  --quiet

echo "Hosted at ${URL}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Hosted"
    echo
    echo "${URL}"
    echo
    echo "Add this authorized redirect URI to the Google OAuth client:"
    echo
    echo "${URL}/api/auth/callback/google"
  } >> "$GITHUB_STEP_SUMMARY"
fi
