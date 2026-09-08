#!/bin/sh
set -e

echo "[ticket-api] applying schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "[ticket-api] seeding..."
node dist/seed.js

echo "[ticket-api] starting server..."
exec node dist/index.js
