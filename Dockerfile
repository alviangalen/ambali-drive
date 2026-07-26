# 1. Base image
FROM node:22-alpine AS base
WORKDIR /app
# Pin pnpm to v8 to avoid strict-dep-builds issues in CI/Docker
RUN npm install -g pnpm@8

# 2. Install ALL dependencies (dev + prod) for the build
FROM base AS dependencies
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
# pnpm v8 does not have strict-dep-builds enforcement
RUN pnpm install --no-frozen-lockfile

# 3. Build step — compile frontend and backend
FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY . .
# Generate Prisma Client
RUN cd backend && node_modules/.bin/prisma generate
# Build frontend (Vite) and backend (tsc) concurrently
RUN pnpm -r run build

# 4. Lean production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pm2

# Copy only what's needed at runtime
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma

ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

# Run prisma migrate then start the server
CMD ["sh", "-c", "cd backend && node_modules/.bin/prisma migrate deploy && pm2-runtime start dist/server.js"]
