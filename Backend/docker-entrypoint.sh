#!/bin/sh
set -e

echo "[docker-entrypoint] Starting IFC Conversion Worker..."

# Verify critical environment variables
if [ -z "$RABBITMQ_URL" ]; then
    echo "[docker-entrypoint] ERROR: RABBITMQ_URL is not set"
    exit 1
fi

# Ensure temp directory exists (bind-mounted or local)
mkdir -p /tmp/orbit-ifc-worker

echo "[docker-entrypoint] All checks passed, starting worker..."
echo "[docker-entrypoint] RABBITMQ_URL=$RABBITMQ_URL"
echo "[docker-entrypoint] MONGODB_URI=$MONGODB_URI"
echo "[docker-entrypoint] XEOKIT_CONVERTER_URL=$XEOKIT_CONVERTER_URL"
echo "[docker-entrypoint] IFC_TEMP_DIR=$IFC_TEMP_DIR"

# Run the IFC conversion worker
exec node /app/workers/ifcConversionWorker.js
