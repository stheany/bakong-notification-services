# -----------------------------------------------------
# 🏗️ Stage 1 — Build shared and backend packages
# -----------------------------------------------------
FROM node:20-alpine AS builder

# Add build dependencies for native modules and shared packages
RUN apk add --no-cache tar python3 py3-setuptools build-base

WORKDIR /opt/bk_notification_service

# Cache busting to ensure fresh build after configuration changes
ARG CACHE_BUST=1
ENV CACHE_BUST=${CACHE_BUST}

# Copy workspace configuration and package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy TypeScript and NestJS configurations
COPY tsconfig*.json ./
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/packages/shared/tsconfig*.json ./apps/packages/shared/
COPY apps/backend/nest-cli.json ./apps/backend/

# Install dependencies for the entire workspace
RUN set -eux; \
  status=0; \
  for i in 1 2 3; do \
  npm ci --legacy-peer-deps && status=0 && break || status=$?; \
  echo "⚠️  npm install attempt $i failed (exit code $status), retrying..." && sleep 5; \
  done; \
  if [ $status -ne 0 ]; then echo "❌ npm ci failed after 3 attempts"; exit 1; fi

# Ensure helmet is installed explicitly
RUN npm install helmet --legacy-peer-deps

# Debug step to verify @nestjs/common installation
RUN ls -la /opt/bk_notification_service/node_modules/@nestjs/common || echo "@nestjs/common not found"

# Build shared package
COPY apps/packages/shared/ ./apps/packages/shared/
RUN npm run build:shared

# Build backend package
COPY apps/backend/ ./apps/backend/
RUN cd apps/backend && npm run build && ls -la /opt/bk_notification_service/apps/backend/dist

# Debug step to verify the dist folder in the builder stage
RUN ls -la /opt/bk_notification_service/apps/backend/dist

# -----------------------------------------------------
# 🏗️ Stage 2 — Final runtime image
# -----------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /opt/bk_notification_service

# Copy built artifacts from the builder stage
COPY --from=builder /opt/bk_notification_service/apps/backend/dist /opt/bk_notification_service/apps/backend/dist

# Copy category type images (needed for seeding default category types)
COPY apps/backend/assets ./assets
COPY apps/backend/assets ./apps/backend/assets

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Force reinstall all dependencies in the runtime stage
RUN npm install --legacy-peer-deps

# Start the application
CMD ["node", "apps/backend/dist/main.js"]
