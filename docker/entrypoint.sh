#!/bin/sh
set -e

# Optional: if Prisma client was not generated at build for some reason
# npx prisma generate

# Apply DB migrations in production-safe way (no dev prompts)
npx prisma migrate deploy

# Start the API
node dist/app.js
