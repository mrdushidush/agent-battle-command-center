FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Generate Prisma client
RUN pnpm --filter @abcc/api db:generate

# Build
RUN pnpm --filter @abcc/shared build
RUN pnpm --filter @abcc/api build

ENV NODE_ENV=production

# Run as non-root user
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

EXPOSE 3001

WORKDIR /app/packages/api

# Copy and setup entrypoint script (convert Windows line endings)
COPY packages/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

USER appuser
CMD ["sh", "/docker-entrypoint.sh"]
