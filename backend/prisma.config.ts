import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback

export default defineConfig({
  earlyAccess: true,
  studio: {
    port: 5555,
  },
  migrations: {
    url: process.env.DATABASE_URL
  }
});
