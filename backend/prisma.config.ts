import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  studio: {
    port: 5555,
  },
  migrations: {
    // In Docker, DATABASE_URL is injected directly as an env var.
    // In dev, it's read from ../.env via the shell or dotenv in server.ts.
    url: process.env.DATABASE_URL,
  },
});
