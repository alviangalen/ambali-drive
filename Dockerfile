# 1. Base image for shared dependencies
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# 2. Dependencies
FROM base AS dependencies
WORKDIR /app
# Copy workspace configuration and package.json files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm config set ignore-scripts false
RUN pnpm install --no-frozen-lockfile

# 3. Build step
FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY . .
# Generate Prisma Client
RUN cd backend && pnpm exec prisma generate
# Build frontend and backend
RUN pnpm -r run build

# 4. Production image
FROM node:22-alpine AS runner
WORKDIR /app

# We only need production dependencies in the final image, but since we are using
# pnpm workspaces, it's simpler to copy the built artifacts and re-install prod only,
# or just copy the pruned node_modules. For simplicity, we will copy the built files.
RUN npm install -g pnpm pm2

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

# Install production dependencies only
RUN pnpm config set ignore-scripts false
RUN pnpm install --prod --no-frozen-lockfile
# Generate prisma client for production
RUN cd backend && pnpm exec prisma generate

# Copy built code
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

# Run prisma migrate deploy before starting the server
CMD ["sh", "-c", "cd backend && pnpm exec prisma migrate deploy && pm2-runtime start dist/server.js"]
