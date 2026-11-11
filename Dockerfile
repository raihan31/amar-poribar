# syntax=docker/dockerfile:1
# Multi-target image for the TypeScript workspace. Targets: api, worker, web, admin, fakes.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY tools/fakes/package.json tools/fakes/
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages packages
COPY apps/api apps/api
COPY apps/web apps/web
COPY apps/admin apps/admin
COPY tools/fakes tools/fakes
RUN pnpm build

FROM build AS api
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]

# Same build as api; runs jobs and the outbox drainer, serves /health on 4001.
FROM build AS worker
ENV NODE_ENV=production ROLE=worker
WORKDIR /repo/apps/api
EXPOSE 4001
CMD ["node", "dist/worker.js"]

FROM build AS web
ENV NODE_ENV=production
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]

FROM build AS admin
ENV NODE_ENV=production
WORKDIR /repo/apps/admin
EXPOSE 3100
CMD ["pnpm", "start"]

FROM build AS fakes
ENV NODE_ENV=production
WORKDIR /repo
EXPOSE 4100
CMD ["node", "tools/fakes/dist/server.js"]
