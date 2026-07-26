# 1. Base image
FROM node:22-alpine AS base
WORKDIR /app
# Pin pnpm to v8 to avoid strict-dep-builds policy issues in CI/Docker
RUN npm install -g pnpm@8

# 2. Install ALL dependencies (dev + prod) for the build
FROM base AS dependencies
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --no-frozen-lockfile

# 3. Build step — compile frontend and backend
FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY . .
# Generate Prisma Client
RUN cd backend && pnpm exec prisma generate
# Build frontend (Vite) and backend (tsc)
RUN pnpm -r run build

# 4. Deploy step — create a self-contained, flat node_modules for backend (no symlinks)
FROM base AS deploy
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma
# Install all deps first so pnpm can resolve the workspace
RUN pnpm install --no-frozen-lockfile
COPY --from=build /app/backend/dist ./backend/dist
# pnpm deploy creates a flat, self-contained node_modules — safe to copy between stages
RUN pnpm --filter backend deploy --prod /app/backend-standalone
# Regenerate Prisma client inside the standalone directory
RUN cp -r backend/prisma /app/backend-standalone/prisma \
    && cd /app/backend-standalone && node_modules/.bin/prisma generate

# 5. Lean production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pm2

# Copy the self-contained backend (flat node_modules, no symlinks)
COPY --from=deploy /app/backend-standalone ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

# Run prisma migrate then start the server
CMD ["sh", "-c", "cd backend && node_modules/.bin/prisma migrate deploy && pm2-runtime start dist/server.js"]
