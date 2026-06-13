# syntax=docker/dockerfile:1
# Single deployable unit: the Express API serves /api AND the built SPA.

# --- Stage 1: build the front-end SPA ---
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
# Bake the REAL (Azure) provider into the production bundle.
ENV VITE_AGENT_PROVIDER=foundry
RUN npm run build

# --- Stage 2: runtime (API server + built SPA) ---
FROM node:22-slim AS runtime
WORKDIR /app
# The server imports shared modules (foundryConfig, seed, types) from ../src at
# runtime via tsx + the @/* path alias, so the front-end source is required.
COPY src ./src
COPY --from=web /app/dist ./dist
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
ENV NODE_ENV=production
ENV SPA_DIST=/app/dist
EXPOSE 8787
# Migrations/seed are a one-time step (see DEPLOY.md) — the container just serves.
CMD ["npm", "start"]
