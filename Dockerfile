# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
# `next build` doesn't need the database (pages render per request), so no
# MONGODB_URI is required here. Seeding happens when the container starts.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ---- run ----
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
# Launch-data seed (creates indexes, loads data once) — run on start.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

USER node
EXPOSE 3000

# MONGODB_URI (and optionally MONGODB_DB) must be provided at runtime.
CMD ["sh", "-c", "node scripts/seed-once.mjs && npx next start"]
