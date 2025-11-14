# -----------------------------------------------------
# 🏗️ Stage 1 — Build backend and shared packages
# -----------------------------------------------------
FROM node:20-alpine AS builder

# Enable faster builds
ENV NODE_ENV=development

WORKDIR /opt/bk_notification_service

# Copy package manifests
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy TypeScript config files
COPY tsconfig*.json ./
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/packages/shared/tsconfig*.json ./apps/packages/shared/
COPY apps/backend/nest-cli.json ./apps/backend/

# -----------------------------------------------------
# Install all workspace dependencies
# -----------------------------------------------------
RUN npm ci --legacy-peer-deps

# Copy full source
COPY apps/backend ./apps/backend
COPY apps/packages/shared ./apps/packages/shared

# Build shared first (it’s imported by backend)
WORKDIR /opt/bk_notification_service/apps/packages/shared
RUN npm run build

# Build backend (NestJS)
WORKDIR /opt/bk_notification_service/apps/backend
RUN npm run build

# -----------------------------------------------------
# 🧱 Stage 2 — Runtime image
# -----------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production

WORKDIR /opt/bk_notification_service

# Copy root package files for workspace resolution
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy built code and node_modules from builder
COPY --from=builder /opt/bk_notification_service/node_modules ./node_modules
COPY --from=builder /opt/bk_notification_service/apps/backend/dist ./dist
COPY --from=builder /opt/bk_notification_service/apps/packages/shared/dist ./apps/packages/shared/dist

# ✅ Verify critical dependency exists
RUN test -d node_modules/@nestjs/core || (echo "❌ Missing @nestjs/core"; exit 1)

# Healthcheck (optional)
HEALTHCHECK CMD node -e "require('http').get('http://localhost:4005/health', r => process.exit(0)).on('error', e => process.exit(1))" || exit 1

# Default command
CMD ["node", "dist/main.js"]
    