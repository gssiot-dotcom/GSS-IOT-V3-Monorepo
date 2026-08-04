# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui

ARG VITE_API_BASE_URL
ARG VITE_AUTH_CSRF_COOKIE_NAME=gss_csrf

RUN test -n "$VITE_API_BASE_URL" \
    && pnpm --filter @gss-iot/config build \
    && pnpm --filter @gss-iot/contracts build \
    && pnpm --filter @gss-iot/ui build \
    && VITE_API_BASE_URL="$VITE_API_BASE_URL" \
       VITE_AUTH_CSRF_COOKIE_NAME="$VITE_AUTH_CSRF_COOKIE_NAME" \
       pnpm --filter web build

FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
