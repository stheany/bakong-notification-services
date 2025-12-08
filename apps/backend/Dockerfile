# -----------------------------------------------------
# 🏗️ Stage 1 — Build backend and shared packages
# -----------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /opt/bk_notification_service
ENV NODE_ENV=development

# -----------------------------------------------------
# Copy all package manifests
# -----------------------------------------------------
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# -----------------------------------------------------
# Copy TypeScript configs
# -----------------------------------------------------
COPY tsconfig*.json ./
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/packages/shared/tsconfig*.json ./apps/packages/shared/
COPY apps/backend/nest-cli.json ./apps/backend/

# -----------------------------------------------------
# Configure npm for better network reliability
# -----------------------------------------------------
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000

# -----------------------------------------------------
# Install dependencies with retry logic
# -----------------------------------------------------
RUN npm ci --legacy-peer-deps || \
    (echo "⚠️  First npm ci failed, retrying..." && sleep 5 && npm ci --legacy-peer-deps) || \
    (echo "⚠️  Second npm ci failed, retrying again..." && sleep 10 && npm ci --legacy-peer-deps)

# Install backend dependencies with retry logic
WORKDIR /opt/bk_notification_service/apps/backend
RUN npm ci --legacy-peer-deps || \
    (echo "⚠️  Backend npm ci failed, retrying..." && sleep 5 && npm ci --legacy-peer-deps) || \
    (echo "⚠️  Backend npm ci failed again, retrying..." && sleep 10 && npm ci --legacy-peer-deps)

WORKDIR /opt/bk_notification_service

# -----------------------------------------------------
# Copy full source
# -----------------------------------------------------
COPY apps/backend ./apps/backend
COPY apps/packages/shared ./apps/packages/shared

# Build shared first
WORKDIR /opt/bk_notification_service/apps/packages/shared
RUN npm run build

# Build backend
WORKDIR /opt/bk_notification_service/apps/backend
# Build TypeScript and fix paths
# Use npm exec to run tsc and tsc-alias (more reliable than npx in Alpine)
RUN npm exec -- tsc -p tsconfig.json && npm exec -- tsc-alias -p tsconfig.json
# Fix remaining src/ paths that tsc-alias might have missed
RUN node fix-paths.js

# -----------------------------------------------------
# 🚀 Stage 2 — Runtime
# -----------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /opt/bk_notification_service
ENV NODE_ENV=production

# Install build dependencies needed for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files (needed for workspace structure)
COPY package*.json ./
COPY package-lock.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy built code
COPY --from=builder /opt/bk_notification_service/apps/backend/dist ./dist
COPY --from=builder /opt/bk_notification_service/apps/packages/shared/dist ./apps/packages/shared/dist

<<<<<<< HEAD
# Configure npm for better network reliability
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000
=======
# Copy category type images (needed for seeding default category types)
# These images are used by CategoryTypeService to seed default category types on startup
# Copy to both root assets and apps/backend/assets for path compatibility
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./assets
COPY --from=builder /opt/bk_notification_service/apps/backend/assets ./apps/backend/assets
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3

# Install production dependencies (rebuilds native modules like bcrypt for correct architecture)
# Try workspace install first, fallback to installing all deps if needed (ensures @nestjs/core is available)
WORKDIR /opt/bk_notification_service
RUN npm ci --legacy-peer-deps --omit=dev --workspace=apps/backend --workspace=apps/packages/shared 2>&1 || \
    (echo "⚠️  Workspace install with --omit=dev failed, retrying..." && sleep 5 && \
     npm ci --legacy-peer-deps --omit=dev --workspace=apps/backend --workspace=apps/packages/shared 2>&1) || \
    (echo "⚠️  Workspace install with --omit=dev failed again, installing all dependencies..." && \
     npm ci --legacy-peer-deps --workspace=apps/backend --workspace=apps/packages/shared 2>&1 || \
     (echo "⚠️  Workspace install failed, retrying..." && sleep 5 && \
      npm ci --legacy-peer-deps --workspace=apps/backend --workspace=apps/packages/shared 2>&1) || \
     (echo "⚠️  Workspace install failed, trying individual installs..." && \
      cd apps/backend && (npm ci --legacy-peer-deps || (sleep 5 && npm ci --legacy-peer-deps)) && \
      cd ../packages/shared && (npm ci --legacy-peer-deps || (sleep 5 && npm ci --legacy-peer-deps)) || true))

# Verify @nestjs/core is actually installed and can be required
WORKDIR /opt/bk_notification_service
RUN NODE_PATH=/opt/bk_notification_service/node_modules:/opt/bk_notification_service/apps/backend/node_modules:$NODE_PATH \
  node -e "try { const core = require('@nestjs/core'); console.log('✅ @nestjs/core found, version:', core.VERSION || 'unknown'); } catch(e) { console.error('❌ @nestjs/core NOT FOUND - this will cause runtime errors!'); console.error('   Error:', e.message); console.error('   Searching for @nestjs...'); require('child_process').exec('find . -name \"@nestjs\" -type d 2>/dev/null | head -5', (err, stdout) => { console.log(stdout || '  No @nestjs directories found'); process.exit(1); }); }"

# Remove build dependencies to reduce image size (keep only runtime dependencies)
# Note: Native modules are already compiled, so build tools are no longer needed
RUN apk del python3 make g++

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
