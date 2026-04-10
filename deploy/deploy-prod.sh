#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env"

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "docker-compose is required on the server" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production env file: $ENV_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config >/dev/null

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis minio
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build api web

# Work around docker-compose v1 recreation issues on newer Docker releases.
for pattern in sporza-api sporza-web sporza-caddy; do
  ids="$(docker ps -aq --filter "name=${pattern}" || true)"

  if [ -n "$ids" ]; then
    docker rm -f $ids >/dev/null 2>&1 || true
  fi
done

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api web caddy
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "--- api health"
curl -fsS --max-time 20 https://sporza.ru/v1/health || true
echo
