# ---- Base build stage ----
FROM node:20-alpine AS builder  

WORKDIR /opt/bk_notification_service
    
# Copy dependency manifests
COPY package*.json ./
COPY package-lock.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/backend/package-lock.json ./apps/backend/

# Build backend
WORKDIR /opt/bk_notification_service/apps/backend
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /opt/bk_notification_service
COPY --from=builder /opt/bk_notification_service/apps/backend/dist ./dist
COPY apps/backend/package*.json ./

RUN npm ci --omit=dev

CMD ["node", "dist/main.js"]
