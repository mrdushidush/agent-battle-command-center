FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Build shared first, then ui
RUN pnpm --filter @abcc/shared build

# Build args for Vite environment variables
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_API_KEY

# Set environment variables for Vite build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_API_KEY=${VITE_API_KEY}

RUN pnpm --filter @abcc/ui build

# Production image
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html

# Copy nginx config as template (API key injected at startup)
COPY packages/ui/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 5173

# At startup, replace ABCC_API_KEY_PLACEHOLDER with the real API key, then start nginx
CMD sh -c "sed \"s/ABCC_API_KEY_PLACEHOLDER/\${VITE_API_KEY:-no_key}/\" /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
