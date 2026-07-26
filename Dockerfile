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
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY . .
# Generate Prisma Client (uses prisma devDep, output goes into @prisma/client prodDep)
RUN cd backend && node_modules/.bin/prisma generate
# Build frontend (Vite) and backend (tsc)
RUN pnpm -r run build

# 4. Deploy step — pnpm deploy creates a flat, self-contained node_modules (no symlinks)
# @prisma/client (with generated code) is a prodDep so it gets included automatically
FROM base AS deploy
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/src ./backend/src
# Need all deps so pnpm can resolve the workspace graph
RUN pnpm install --no-frozen-lockfile
# Copy generated Prisma client from build stage into the correct location
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/backend/dist ./backend/dist
# pnpm deploy creates a flat standalone directory safe to copy to final image
RUN pnpm --filter backend deploy --prod /app/backend-standalone
# Copy compiled code and prisma schema into standalone dir
COPY --from=build /app/backend/dist /app/backend-standalone/dist
COPY backend/prisma /app/backend-standalone/prisma
# Copy the generated prisma client into standalone node_modules
COPY --from=build /app/backend/node_modules/.prisma /app/backend-standalone/node_modules/.prisma

# 5. Lean production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pm2

# Copy the self-contained backend (flat node_modules, no symlinks)
COPY --from=deploy /app/backend-standalone ./backend
# Copy built frontend to be served as static files
COPY --from=build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

# Run prisma migrate then start the server via pm2
CMD ["sh", "-c", "cd backend && node_modules/.bin/prisma migrate deploy && pm2-runtime start dist/server.js"]
