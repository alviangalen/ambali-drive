import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  migrations: {
    // Falls back to the Docker 'db' service if DATABASE_URL isn't injected.
    // Both point to the same PostgreSQL container defined in docker-compose.yml.
    url: process.env.DATABASE_URL ?? 'postgresql://ambali_user:PasswordSangatKuat123!@db:5432/ambalidrive',
  },
});
