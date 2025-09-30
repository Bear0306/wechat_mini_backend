#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set."
  exit 1
fi

has_migrations="false"
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  has_migrations="true"
fi

if [ "$has_migrations" = "true" ]; then
  echo "▶ prisma migrate deploy (migrations found)"
  npx prisma migrate deploy
else
  echo "▶ prisma db push (no migrations found)"
  # For a brand-new/empty DB this is safe.
  # If your DB already has tables, see Path 2 below.
  npx prisma db push
fi

echo "▶ starting API..."
exec node dist/app.js
