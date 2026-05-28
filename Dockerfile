# Multi-stage: build, sen slim runtime
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# deps först (för layer-cache)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# build-time env-vars som Vite ska baka in i bundle.
# Vite läser .env-filer, inte process.env, så vi måste skriva en
# .env.production-fil med VITE_*-vars innan vite build körs.
ARG VITE_APP_ID
ARG VITE_DEMO_LOGIN_KEY

# bygg
COPY . .
RUN printf 'VITE_APP_ID=%s\nVITE_DEMO_LOGIN_KEY=%s\n' "$VITE_APP_ID" "$VITE_DEMO_LOGIN_KEY" > .env.production && \
    pnpm exec vite build && \
    pnpm exec esbuild server/_core/index.ts \
      --platform=node --packages=external --bundle --format=esm \
      --outdir=dist

# runtime
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

ENV NODE_ENV=production
ENV PORT=3000

# alla deps (drizzle-kit behövs för db:push vid startup)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# built artifacts
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY shared ./shared

EXPOSE 3000

# migrera DB först (idempotent), sen starta server
CMD ["sh", "-c", "pnpm db:push && node dist/index.js"]
