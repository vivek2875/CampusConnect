FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @campusconnect/api build && pnpm --filter @campusconnect/web build

FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=10000 \
    SERVE_WEB_CLIENT=true \
    WEB_DIST_PATH=/app/apps/web/dist

RUN addgroup -S campusconnect && adduser -S campusconnect -G campusconnect
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

USER campusconnect
EXPOSE 10000

CMD ["node", "apps/api/dist/server.js"]
