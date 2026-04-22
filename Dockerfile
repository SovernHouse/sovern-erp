# Multi-stage build for Trading ERP
# Stage 1: Build all 3 frontends
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Install dependencies
COPY frontend/shared/package*.json ./frontend/shared/
COPY frontend/admin-portal/package*.json ./frontend/admin-portal/
COPY frontend/customer-portal/package*.json ./frontend/customer-portal/
COPY frontend/factory-portal/package*.json ./frontend/factory-portal/
COPY package.json ./

RUN npm ci

# Copy source code
COPY frontend/ ./frontend/

# Build admin portal
WORKDIR /app/frontend/admin-portal
RUN npm run build

# Build customer portal
WORKDIR /app/frontend/customer-portal
RUN npm run build

# Build factory portal
WORKDIR /app/frontend/factory-portal
RUN npm run build

# Stage 2: Production Node.js image with backend + built frontends
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy backend application code
COPY backend/ .

# Copy built frontends
COPY --from=frontend-builder /app/frontend/admin-portal/dist ./public/admin
COPY --from=frontend-builder /app/frontend/customer-portal/dist ./public/customer
COPY --from=frontend-builder /app/frontend/factory-portal/dist ./public/factory

# Create necessary directories
RUN mkdir -p uploads logs && chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
