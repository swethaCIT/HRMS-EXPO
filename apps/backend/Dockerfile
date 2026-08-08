# Build context is the REPO ROOT, not apps/backend — this is an npm workspaces
# monorepo, so the only lockfile is the hoisted one at the root. Building from
# apps/backend meant `npm ci` had no package-lock.json and failed every time,
# which is why no image was ever produced. See docker-compose.yml.
FROM node:22-alpine AS builder
WORKDIR /app

# bcrypt ships a prebuilt binary for most targets, but keep the toolchain around
# in the builder stage so a source build can succeed if it doesn't.
RUN apk add --no-cache python3 make g++

# Copy only the manifests first so dependency install stays cached when source changes.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/mobile/package.json ./apps/mobile/

# Install the backend workspace's dependencies (and its dev deps, needed to build).
RUN npm ci --workspace=apps/backend --include-workspace-root

COPY apps/backend ./apps/backend
RUN npm run build --workspace=apps/backend

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/mobile/package.json ./apps/mobile/

RUN npm ci --omit=dev --workspace=apps/backend --include-workspace-root \
    && npm cache clean --force

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# main.ts reads PORT and falls back to 3000.
EXPOSE 3000
CMD ["node", "apps/backend/dist/main"]
