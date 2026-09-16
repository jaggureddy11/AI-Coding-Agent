# ==============================================================================
# JAGGU Backend Proxy Server - Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required for monorepo compilation
COPY package*.json ./
COPY packages/jaggu-core/package*.json ./packages/jaggu-core/
COPY packages/jaggu-server/package*.json ./packages/jaggu-server/

RUN npm ci --workspace=@jaggu/core --workspace=@jaggu/server

# Copy source files
COPY packages/jaggu-core ./packages/jaggu-core
COPY packages/jaggu-server ./packages/jaggu-server
COPY tsconfig*.json ./

# Compile packages
RUN npm run build --workspace=@jaggu/core
RUN npm run build --workspace=@jaggu/server

# --- Stage 2: Minimal Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install curl for container healthcheck
RUN apk --no-cache add curl

# Copy package manifests & install production dependencies only
COPY package*.json ./
COPY packages/jaggu-core/package*.json ./packages/jaggu-core/
COPY packages/jaggu-server/package*.json ./packages/jaggu-server/

RUN npm ci --omit=dev --workspace=@jaggu/core --workspace=@jaggu/server && npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/jaggu-core/dist ./packages/jaggu-core/dist
COPY --from=builder /app/packages/jaggu-server/dist ./packages/jaggu-server/dist

# Security: Run as non-root user
USER node

EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

WORKDIR /app/packages/jaggu-server

CMD ["node", "dist/index.js"]
