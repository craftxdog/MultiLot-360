# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV YARN_CACHE_FOLDER=/yarn-cache
WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable


FROM base AS dependencies

COPY package.json yarn.lock ./
RUN --mount=type=cache,id=multilot-yarn-development,target=/yarn-cache,sharing=locked \
  yarn install --frozen-lockfile


FROM dependencies AS builder

COPY nest-cli.json tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Prisma only needs a syntactically valid URL while generating the client.
# Dokploy supplies the real production connection string at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build yarn prisma:generate \
  && yarn build


FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package.json yarn.lock prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,id=multilot-yarn-production,target=/yarn-cache,sharing=locked \
  yarn install --frozen-lockfile --production=true \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build yarn prisma:generate


FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('node:http').get('http://127.0.0.1:3000/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["node", "dist/src/main.js"]
