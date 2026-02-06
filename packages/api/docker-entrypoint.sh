#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed || echo "Seeding skipped or already done"

echo "Starting server..."
exec node dist/index.js
