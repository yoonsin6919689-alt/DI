# Self-hosted DIMENSION: build the frontend, then run the Node server that
# serves dist/ and the API. Data (SQLite + uploaded images) lives in /data,
# which must be mounted as a volume so it survives redeploys.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DIST_DIR=/app/dist \
    DATABASE_FILE=/data/app.db \
    STORAGE_DIR=/data/objects
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY functions ./functions
COPY server ./server
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "server/index.mjs"]
