# ─── Build Stage ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifest + lockfile first (cache layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/agent/package.json ./packages/agent/

# Install only agent dependencies
RUN pnpm install --frozen-lockfile --filter @tennis-coach/agent

# Copy agent source and compile
COPY packages/agent ./packages/agent/
RUN pnpm --filter @tennis-coach/agent build

# ─── Runtime Stage ────────────────────────────────────────────────────
FROM node:20-alpine

# ffmpeg is required for frame extraction
RUN apk add --no-cache ffmpeg

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifest + lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/agent/package.json ./packages/agent/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @tennis-coach/agent --prod

# Copy compiled output from builder
COPY --from=builder /app/packages/agent/dist ./packages/agent/dist

EXPOSE 3001

CMD ["node", "packages/agent/dist/index.js"]
