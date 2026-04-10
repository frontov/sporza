FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/

RUN npm ci

COPY . .

RUN npm run build --workspace @sporza/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/docs docs

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]
