import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  migrations: {
    // process.env.DATABASE_URL is set by the Dockerfile ENV and docker-compose environment.
    // start.sh also writes it to /app/.env and /app/backend/.env as a fallback.
    url: process.env.DATABASE_URL || 'postgresql://ambali_user:PasswordSangatKuat123!@db:5432/ambalidrive',
  },
});
