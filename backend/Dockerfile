# Multi-stage Dockerfile for NestJS Backend

# Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# Development stage
FROM base AS development
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Builder stage
FROM base AS builder
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/run-migration.js ./run-migration.js
COPY --from=builder /app/src/database/migrations ./src/database/migrations
COPY --from=builder /app/migrations ./migrations
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
