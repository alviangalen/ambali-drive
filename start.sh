#!/bin/sh
set -e

# Pastikan DATABASE_URL tersedia. Gunakan fallback jika tidak ada.
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://user_ambali:Kimiicantik123*@db-ambali:5432/ambalidrive"
fi

echo "==> DATABASE_URL is set to: $DATABASE_URL"

# Tulis DATABASE_URL ke file .env di direktori backend
# Ini memastikan prisma.config.ts bisa membacanya via dotenv
printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /app/backend/.env
printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /app/.env

echo "==> Running prisma db push..."
cd /app/backend
node_modules/.bin/prisma db push

echo "==> Starting server..."
pm2-runtime start dist/server.js
