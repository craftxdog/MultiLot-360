#!/usr/bin/env bash

set -euo pipefail

compose_file="docker-compose.smoke.yaml"
image="${1:-multilot-api360:smoke}"
port="${API_SMOKE_PORT:-3100}"

cleanup() {
  API_IMAGE="$image" API_SMOKE_PORT="$port" \
    docker compose --file "$compose_file" down --volumes --remove-orphans
}

trap cleanup EXIT

if [[ $# -eq 0 ]]; then
  docker build --target runner --tag "$image" .
else
  docker pull "$image"
fi

API_IMAGE="$image" API_SMOKE_PORT="$port" \
  docker compose --file "$compose_file" up --detach --no-build --wait

base_url="http://127.0.0.1:${port}"

curl --fail --silent --show-error "$base_url/api/v1/health" >/dev/null
curl --fail --silent --show-error "$base_url/api/v1/health/ready" >/dev/null

protected_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$base_url/api/v1/sales"
)"
docs_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$base_url/docs"
)"

if [[ "$protected_status" != "401" ]]; then
  echo "Expected protected endpoint to return 401, got $protected_status" >&2
  exit 1
fi

if [[ "$docs_status" != "404" ]]; then
  echo "Expected Swagger to be disabled with 404, got $docs_status" >&2
  exit 1
fi

echo "Docker smoke passed for $image"

