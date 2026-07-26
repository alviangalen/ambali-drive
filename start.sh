#!/bin/sh
set -e

# Pastikan DATABASE_URL tersedia. Gunakan fallback jika tidak ada.
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://ambali_user:PasswordSangatKuat123!@db:5432/ambalidrive"
fi

echo "==> DATABASE_URL is set to: $DATABASE_URL"

# Tulis DATABASE_URL ke file .env di direktori backend
# Ini memastikan prisma.config.ts bisa membacanya via dotenv
printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /app/backend/.env
printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /app/.env

echo "==> Running prisma migrate deploy..."
cd /app/backend
node_modules/.bin/prisma migrate deploy

echo "==> Starting server..."
pm2-runtime start dist/server.js
