#!/bin/sh
set -e

cd /app/apps/api

echo "==> Running database migrations..."
prisma migrate deploy --config=prisma.config.ts

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Running database seed..."
  TS_NODE_PROJECT=tsconfig.seed.json node -r tsconfig-paths/register dist-seed/prisma/seed.js
  echo "==> Seed completed."
else
  echo "==> Skipping seed (RUN_SEED != true)"
fi

echo "==> Starting API server..."
exec node -r tsconfig-paths/register dist/apps/api/src/main
