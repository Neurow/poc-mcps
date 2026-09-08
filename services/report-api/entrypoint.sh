#!/bin/sh
set -e

echo "[report-api] applying schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "[report-api] seeding..."
node dist/seed.js

echo "[report-api] starting server..."
exec node dist/index.js
