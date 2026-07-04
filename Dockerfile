# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo root configurations and all workspace manifests
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY apps/mobile/package*.json ./apps/mobile/

# Install dependencies for the entire monorepo
RUN npm install

# Copy application source code
COPY . .

# Build the Next.js web application
RUN npm run web:build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy root manifest and workspaces
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package*.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 8080

# Start Next.js using the monorepo start script
CMD ["npm", "run", "web:start"]
