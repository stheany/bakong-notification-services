# ---- Base build stage ----
FROM node:20-alpine AS builder  

WORKDIR /opt/bk_notification_service
    
# Copy dependency manifests
COPY package*.json ./
COPY package-lock.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy TypeScript config files
COPY tsconfig.json ./
COPY apps/packages/shared/tsconfig.json ./apps/packages/shared/
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/nest-cli.json ./apps/backend/

# Install dependencies at root level (handles npm workspaces)
RUN npm ci

# Copy shared package source files
COPY apps/packages/shared/src ./apps/packages/shared/src

# Build shared package first (backend depends on it)
WORKDIR /opt/bk_notification_service/apps/packages/shared
RUN npm run build

# Create symlink for dist-cjs (tsconfig references dist-cjs but package builds to dist)
RUN ln -s dist dist-cjs || true

# Copy backend source files
WORKDIR /opt/bk_notification_service
COPY apps/backend/src ./apps/backend/src

# Build backend
WORKDIR /opt/bk_notification_service/apps/backend
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /opt/bk_notification_service

# Copy root package files for workspace setup
COPY package*.json ./
COPY package-lock.json ./

# Copy backend package files
COPY apps/backend/package*.json ./apps/backend/

# Copy shared package files (needed for @bakong/shared dependency)
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy built shared package dist (backend depends on it)
COPY --from=builder /opt/bk_notification_service/apps/packages/shared/dist ./apps/packages/shared/dist

# Copy built backend dist
COPY --from=builder /opt/bk_notification_service/apps/backend/dist ./dist

# Install production dependencies in runtime stage
# This ensures all workspace dependencies are correctly installed and linked
# Using npm ci with --omit=dev for production-only dependencies
RUN npm ci --omit=dev

# Note: We reinstall dependencies here instead of copying node_modules because:
# 1. npm workspaces may have dependencies in workspace-specific locations
# 2. Copying node_modules can miss workspace symlinks and dependencies
# 3. Reinstalling ensures the workspace structure is correctly set up
# The --omit=dev flag installs only production dependencies for a smaller image

CMD ["node", "dist/main.js"]
