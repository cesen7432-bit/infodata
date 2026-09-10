# Imagen única para los dos procesos (api y worker) — docker-compose decide
# cuál comando corre cada contenedor. Un solo repositorio, una sola imagen.
# El worker no necesita la SPA, pero comparte la misma imagen por simplicidad.

FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine AS builder
# El motor de Prisma necesita openssl para detectar la versión y cargar sus
# librerías — sin esto, "prisma generate" empaqueta el engine equivocado y
# falla en runtime con "Could not parse schema engine response".
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime

# openssl: lo necesita el motor de Prisma en runtime (ver nota en la etapa builder).
# El resto es Chromium del sistema para el login por navegador de los scrapers
# (Puppeteer no necesita descargar el suyo — variables abajo).
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=web-builder /web/dist ./web/dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
