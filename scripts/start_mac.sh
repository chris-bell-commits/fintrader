#!/usr/bin/env bash
set -euo pipefail

IMAGE="fintrader"
CONTAINER="fintrader"
PORT="8000"
VOLUME="fintrader-data"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUILD=false
if [[ "${1:-}" == "--build" ]]; then
  BUILD=true
fi

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.example to .env and add your keys."
  exit 1
fi

if $BUILD || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building image $IMAGE..."
  docker build -t "$IMAGE" .
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Stopping existing container..."
  docker rm -f "$CONTAINER" >/dev/null
fi

echo "Starting container..."
docker run -d \
  --name "$CONTAINER" \
  -v "${VOLUME}:/app/db" \
  -p "${PORT}:8000" \
  --env-file .env \
  "$IMAGE" >/dev/null

echo "FinTrader is running at http://localhost:${PORT}"
