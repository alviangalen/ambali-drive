import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://user_ambali:Kimiicantik123*@db-ambali:5432/ambalidrive',
  },
});
