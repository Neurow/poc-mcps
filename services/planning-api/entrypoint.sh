#!/bin/sh
set -e

echo "[planning-api] applying schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "[planning-api] seeding..."
node dist/seed.js

echo "[planning-api] starting server..."
exec node dist/index.js
