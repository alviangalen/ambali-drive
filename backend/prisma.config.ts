import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://ambali_user:PasswordSangatKuat123!@db:5432/ambalidrive',
  },
});
