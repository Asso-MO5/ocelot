FROM node:24-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

FROM dependencies AS production-dependencies
RUN rm -rf node_modules && yarn install --frozen-lockfile --production=true && yarn cache clean

FROM dependencies AS migration

COPY migrate.config.ts ./
COPY migrations ./migrations
COPY scripts ./scripts

ENV NODE_ENV=production
CMD ["yarn", "migrate:prod"]

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node docs ./docs

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node --input-type=module -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/docs/openapi.json').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "src/server.ts"]
