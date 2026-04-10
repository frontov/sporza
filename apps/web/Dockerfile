FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/

RUN npm ci

COPY . .

RUN npm run build --workspace @sporza/web

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/package.json apps/web/package.json
COPY --from=builder /app/apps/web/next.config.js apps/web/next.config.js

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
