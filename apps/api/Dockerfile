FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @sharedplaylist/shared-types build
RUN pnpm --filter @sharedplaylist/api db:generate
RUN pnpm --filter @sharedplaylist/api build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=build /app /app
EXPOSE 4000
CMD ["pnpm", "--filter", "@sharedplaylist/api", "start"]
