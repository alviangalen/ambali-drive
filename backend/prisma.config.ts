import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
import path from 'path';

// Load .env files — written by start.sh at container startup
dotenv.config({ path: path.resolve('/app', '.env') });
dotenv.config({ path: path.resolve('/app/backend', '.env') });
dotenv.config(); // fallback

const dbUrl = process.env.DATABASE_URL
  ?? 'postgresql://ambali_user:PasswordSangatKuat123!@db:5432/ambalidrive';

export default defineConfig({
  earlyAccess: true,
  migrations: {
    url: dbUrl,
  },
});
