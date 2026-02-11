# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Cache busting to ensure fresh build after configuration changes
ARG CACHE_BUST=1
ENV CACHE_BUST=${CACHE_BUST}

# -----------------------------------------------------
# Copy workspace configuration and package files
# -----------------------------------------------------
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/packages/shared/package*.json ./apps/packages/shared/

# Copy configuration files
COPY tsconfig.json ./
COPY apps/packages/shared/tsconfig.json ./apps/packages/shared/

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
COPY apps/packages/shared/src ./apps/packages/shared/src
RUN npm run build:shared

# Copy frontend source and build it
COPY apps/frontend/ ./apps/frontend/
# Accept build args for environment variables
ARG VITE_API_BASE_URL
ARG VITE_FRONTEND_PORT=3000
ARG VITE_BASE_URL=/

# Set environment variables for build
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_FRONTEND_PORT=${VITE_FRONTEND_PORT}
ENV VITE_BASE_URL=${VITE_BASE_URL}

WORKDIR /app/apps/frontend
# Verify public folder exists before build (use || true to not fail if missing)
RUN echo "=== Checking public folder ===" && (ls -la public/ || echo "ERROR: public folder does not exist!") && echo "=== Public folder contents above ==="
RUN echo "=== Starting Vite build ===" && npm run build
# Verify the file was copied to dist after build
RUN echo "=== Checking dist folder ===" && ls -la dist/ && echo "=== Looking for NBC-logo.png ===" && (ls -la dist/NBC-logo.png || echo "ERROR: NBC-logo.png NOT FOUND in dist!")

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose ports
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
