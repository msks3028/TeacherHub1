# --- Build stage: install deps (incl. dev) and generate the Prisma client ---
FROM node:20-alpine AS build
WORKDIR /app

# OpenSSL is required by the Prisma engine on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .

# --- Runtime stage: only what's needed to run the server ---
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY src ./src

# Uploaded files land here when STORAGE_DRIVER is unset ("local"). Mount a
# volume at this path in production so files survive container restarts —
# or better, set STORAGE_DRIVER=s3 (see .env.example) so this directory is
# never relied on at all.
RUN mkdir -p /app/uploads /app/logs
VOLUME ["/app/uploads", "/app/logs"]

EXPOSE 5000
# Do not apply historical migrations automatically at startup. Set
# MIGRATE_ON_START=true only after reviewing every pending migration.
CMD ["sh", "-c", "if [ \"$MIGRATE_ON_START\" = \"true\" ]; then npx prisma migrate deploy || exit $?; fi; exec node src/server.js"]
