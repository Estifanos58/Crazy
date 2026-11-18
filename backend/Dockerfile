# Multi-stage Dockerfile for Crazy Card Game Backend (build context: repository root)
FROM node:22-alpine AS builder

WORKDIR /workspace

# Install dependencies cleanly from backend lockfile
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy shared contracts and backend source
COPY shared ./shared
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Compile TypeScript
RUN cd backend && npm run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV REDIS_REQUIRED=true

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /workspace/backend/dist ./dist

USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health/ready || exit 1

CMD ["node", "dist/backend/src/server.js"]
