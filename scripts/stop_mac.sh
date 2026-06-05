#!/usr/bin/env bash
set -euo pipefail

CONTAINER="fintrader"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  docker rm -f "$CONTAINER" >/dev/null
  echo "Stopped and removed container $CONTAINER. Data volume preserved."
else
  echo "Container $CONTAINER is not running."
fi
