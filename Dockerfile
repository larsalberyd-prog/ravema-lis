# Multi-stage: build, sen slim runtime
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# deps först (för layer-cache)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# bygg
COPY . .
RUN pnpm exec vite build && \
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
