#!/bin/sh
set -e

echo "Running database migrations..."
uv run alembic upgrade head

exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}" --proxy-headers --forwarded-allow-ips='*'
