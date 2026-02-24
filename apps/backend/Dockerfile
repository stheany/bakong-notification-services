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
## Removed global tar install; tar will be installed locally via package.json

RUN set -eux; \
  status=0; \
  for i in 1 2 3; do \
  npm ci --legacy-peer-deps && status=0 && break || status=$?; \
  echo "⚠️  npm install attempt $i failed (exit code $status), retrying..." && sleep 5; \
  done; \
  if [ $status -ne 0 ]; then echo "❌ npm ci failed after 3 attempts"; exit 1; fi

# Install rimraf globally to ensure availability for prebuild script
RUN npm install -g rimraf

# Ensure typeorm is installed during the build process
RUN npm install typeorm --legacy-peer-deps --prefix /opt/bk_notification_service/apps/backend

# -----------------------------------------------------
# Build process
# -----------------------------------------------------

# Copy shared source and build it
COPY apps/packages/shared/ ./apps/packages/shared/
RUN npm run build:shared

# Copy backend source and build it
COPY apps/backend/ ./apps/backend/
RUN cd apps/backend && npm run build && ls -la /opt/bk_notification_service/apps/backend/dist

# Debug step to verify the dist folder in the builder stage
RUN ls -la /opt/bk_notification_service/apps/backend/dist

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
COPY --from=builder /opt/bk_notification_service/apps/backend/dist /opt/bk_notification_service/apps/backend/dist
RUN ls -la /opt/bk_notification_service/apps/backend/dist

# Copy category type images (needed for seeding default category types)
# These images are used by CategoryTypeService to seed default category types on startup
# Copy to both root assets and apps/backend/assets for path compatibility
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./assets
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./apps/backend/assets

# Install production dependencies
WORKDIR /opt/bk_notification_service
RUN set -eux; \
  status=0; \
  for i in 1 2 3; do \
  npm ci --legacy-peer-deps --omit=dev --workspace=apps/backend --workspace=apps/packages/shared && status=0 && break || status=$?; \
  echo "⚠️  Production npm install attempt $i failed, retrying..." && sleep 5; \
  done; \
  if [ $status -ne 0 ]; then echo "❌ Production npm ci failed after 3 attempts"; exit 1; fi

# Install dependencies in the backend directory
WORKDIR /opt/bk_notification_service/apps/backend
RUN npm install --legacy-peer-deps

# Force install reflect-metadata in the backend directory
RUN npm install reflect-metadata --legacy-peer-deps --prefix /opt/bk_notification_service/apps/backend

# Verify reflect-metadata installation
RUN ls -la /opt/bk_notification_service/apps/backend/node_modules/reflect-metadata

# Adjust NODE_PATH to include backend node_modules
ENV NODE_PATH=/opt/bk_notification_service/apps/backend/node_modules:/opt/bk_notification_service/node_modules

# Debug reflect-metadata installation
RUN ls -la /opt/bk_notification_service/apps/backend/node_modules/reflect-metadata

# Ensure typeorm is included in the production dependencies
RUN npm install typeorm --legacy-peer-deps --prefix /opt/bk_notification_service/apps/backend

# Consolidate dependency installation and debug steps
RUN npm install --legacy-peer-deps --prefix /opt/bk_notification_service/apps/backend reflect-metadata
RUN npm install --legacy-peer-deps --prefix /opt/bk_notification_service/apps/backend @nestjs/core

# Verify installation of reflect-metadata and @nestjs/core
RUN node -e "try { require('reflect-metadata'); console.log('✅ reflect-metadata is available'); } catch (e) { console.error('❌ reflect-metadata is missing:', e.message); process.exit(1); }"
RUN node -e "try { require('@nestjs/core'); console.log('✅ @nestjs/core is available'); } catch (e) { console.error('❌ @nestjs/core is missing:', e.message); process.exit(1); }"

# Debug NODE_PATH configuration
RUN echo "NODE_PATH is set to: $NODE_PATH"
RUN node -e "console.log('NODE_PATH:', process.env.NODE_PATH);"

# Remove unnecessary debug step for root node_modules
# Verify NODE_PATH configuration
RUN echo "NODE_PATH is set to: $NODE_PATH"

# Log the full directory structure of node_modules
RUN find /opt/bk_notification_service/apps/backend/node_modules -type d | head -n 50
RUN find /opt/bk_notification_service/node_modules -type d | head -n 50

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
