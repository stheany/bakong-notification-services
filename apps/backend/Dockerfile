# -----------------------------------------------------
# 🏗️ Stage 1 — Build backend and shared packages
# -----------------------------------------------------
FROM node:20-alpine AS builder

# Add build dependencies for native modules and shared packages
# build-base and py3-setuptools are required for node-gyp with Python 3.12+
RUN apk add --no-cache tar python3 py3-setuptools build-base

WORKDIR /opt/bk_notification_service

# Cache busting to ensure fresh build after configuration changes
ARG CACHE_BUST=1
ENV CACHE_BUST=${CACHE_BUST}

# -----------------------------------------------------
# Copy workspace configuration and package files
# -----------------------------------------------------
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy TypeScript and NestJS configurations
COPY tsconfig*.json ./
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/packages/shared/tsconfig*.json ./apps/packages/shared/
COPY apps/backend/nest-cli.json ./apps/backend/

# -----------------------------------------------------
# Install dependencies for the entire workspace
# -----------------------------------------------------

RUN set -eux; \
  for i in 1 2 3; do \
  npm ci --legacy-peer-deps && break || \
  (echo "⚠️  npm install attempt $i failed, retrying..." && sleep 5); \
  done

# -----------------------------------------------------
# Build process
# -----------------------------------------------------

# Copy shared source and build it
COPY apps/packages/shared/ ./apps/packages/shared/
RUN npm run build:shared

# Copy backend source and build it
COPY apps/backend/ ./apps/backend/
RUN cd apps/backend && npm run build

# Fix remaining src/ paths that tsc-alias might have missed
RUN node apps/backend/fix-paths.js

# -----------------------------------------------------
# 🚀 Stage 2 — Runtime
# -----------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /opt/bk_notification_service
# NODE_ENV is controlled by docker-compose.yml per environment (development/staging/production)

# Install build dependencies needed for native modules (bcrypt, etc.)
# py3-setuptools is required for node-gyp on Python 3.12
RUN set -eux; \
  for i in 1 2 3; do \
  (apk update && apk add --no-cache python3 py3-setuptools build-base) && break || \
  (echo "⚠️  apk install attempt $i failed, clearing cache and retrying..." && \
  rm -rf /var/cache/apk/* /tmp/* && sleep 5); \
  done; \
  if [ $? -ne 0 ]; then \
  echo "❌ Failed to install packages after 3 attempts"; \
  exit 1; \
  fi

# Copy package files (needed for workspace structure)
COPY package*.json ./
COPY package-lock.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy built code
COPY --from=builder /opt/bk_notification_service/apps/backend/dist ./dist
COPY --from=builder /opt/bk_notification_service/apps/packages/shared/dist ./apps/packages/shared/dist

# Copy category type images (needed for seeding default category types)
# These images are used by CategoryTypeService to seed default category types on startup
# Copy to both root assets and apps/backend/assets for path compatibility
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./assets
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./apps/backend/assets

# Install production dependencies (rebuilds native modules like bcrypt for correct architecture)
# Try workspace install first, fallback to installing all deps if needed (ensures @nestjs/core is available)
WORKDIR /opt/bk_notification_service
RUN npm ci --legacy-peer-deps --omit=dev --workspace=apps/backend --workspace=apps/packages/shared 2>&1 || \
  (echo "⚠️  Workspace install with --omit=dev failed, installing all dependencies to ensure availability..." && \
  npm ci --legacy-peer-deps --workspace=apps/backend --workspace=apps/packages/shared 2>&1 || \
  (echo "⚠️  Workspace install failed, trying individual installs..." && \
  cd apps/backend && npm ci --legacy-peer-deps && \
  cd ../packages/shared && npm ci --legacy-peer-deps || true))

# Verify @nestjs/core is actually installed and can be required
WORKDIR /opt/bk_notification_service
RUN NODE_PATH=/opt/bk_notification_service/node_modules:/opt/bk_notification_service/apps/backend/node_modules:$NODE_PATH \
  node -e "try { const core = require('@nestjs/core'); console.log('✅ @nestjs/core found, version:', core.VERSION || 'unknown'); } catch(e) { console.error('❌ @nestjs/core NOT FOUND - this will cause runtime errors!'); console.error('   Error:', e.message); console.error('   Searching for @nestjs...'); require('child_process').exec('find . -name \"@nestjs\" -type d 2>/dev/null | head -5', (err, stdout) => { console.log(stdout || '  No @nestjs directories found'); process.exit(1); }); }"

# Remove build dependencies to reduce image size (keep only runtime dependencies)
RUN apk del py3-setuptools build-base

# Healthcheck - backend runs on port 8080 inside container
# Health endpoint is at /api/v1/health or /api/v1/management/healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/v1/health', (r) => { if (r.statusCode === 200) process.exit(0); else process.exit(1); }).on('error', () => process.exit(1))"

# Run from root directory but set NODE_PATH to include backend node_modules
# This allows Node.js to find modules in both root and backend node_modules
ENV NODE_PATH=/opt/bk_notification_service/node_modules:/opt/bk_notification_service/apps/backend/node_modules

# Copy runtime path resolver (handles src/ paths at runtime as fallback)
COPY --from=builder /opt/bk_notification_service/apps/backend/runtime-path-resolver.js ./runtime-path-resolver.js

# Use runtime resolver to handle any remaining src/ paths
CMD ["node", "-r", "./runtime-path-resolver.js", "dist/main.js"]
