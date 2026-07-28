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

# 3. Build step — compile frontend and backend, generate Prisma client
FROM base AS build
WORKDIR /app
# Provide a dummy DATABASE_URL so prisma generate can run during build
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=${DATABASE_URL}
ENV NODE_OPTIONS="--max_old_space_size=1536"

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Copy full node_modules from pnpm workspace (includes root .pnpm virtual store)
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY . .
# Generate Prisma Client (output goes to node_modules/@prisma/client & node_modules/.prisma)
RUN cd backend && node_modules/.bin/prisma generate
# Build frontend (Vite) and backend (tsc)
RUN pnpm -r run build

# 4. Lean production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pm2

# Copy compiled backend code
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts

# Copy the entire backend node_modules (includes @prisma/client with generated code)
COPY --from=build /app/backend/node_modules ./backend/node_modules
# Also copy root node_modules which contains the pnpm virtual store (.pnpm folder)
# This ensures all symlinks inside backend/node_modules resolve correctly
COPY --from=build /app/node_modules ./node_modules

# Copy built frontend to be served as static files
COPY --from=build /app/frontend/dist ./frontend/dist

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV NODE_ENV=production
ENV PORT=9000
# Default DATABASE_URL will be injected by docker-compose at runtime from .env
EXPOSE 9000

CMD ["/app/start.sh"]
