# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
    && apt-get install --no-install-recommends --yes openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@9.15.9 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/contracts packages/contracts

RUN pnpm --filter @gss-iot/config build \
    && pnpm --filter @gss-iot/contracts build \
    && pnpm --filter api prisma:generate \
    && pnpm --filter api build \
    && pnpm --filter api deploy /opt/api \
    && pnpm --dir /opt/api exec prisma generate --schema /opt/api/prisma/schema.prisma

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PORT=3000

RUN apt-get update \
    && apt-get install --no-install-recommends --yes dumb-init openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@9.15.9 --activate \
    && groupadd --system --gid 10001 gss \
    && useradd --system --uid 10001 --gid gss --home-dir /app gss

WORKDIR /app

COPY --from=workspace --chown=gss:gss /opt/api ./

USER gss

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
