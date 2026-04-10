# Deploy `sporza.ru`

Цель: поднять production-стек на сервере `146.103.124.234` через Docker Compose.

## Что публикуем

- `sporza.ru` и `www.sporza.ru` -> frontend
- `sporza.ru/v1/*` -> NestJS API
- `sporza.ru/docs` -> Swagger
- `sporza.ru/storage/*` -> MinIO bucket path для публичных файлов

## DNS

Создайте A-записи:

- `sporza.ru` -> `146.103.124.234`
- `www.sporza.ru` -> `146.103.124.234`

## Что должно быть на сервере

- Docker Engine
- Docker Compose plugin
- открыты порты `80` и `443`

## Подготовка env

1. Скопируйте шаблон:

```bash
cp deploy/.env.production.example .env
```

2. Заполните минимум:

- `POSTGRES_PASSWORD`
- `S3_SECRET_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`

## Запуск

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Проверка

```bash
docker compose -f docker-compose.prod.yml --env-file .env ps
curl -I https://sporza.ru
curl -I https://sporza.ru/v1/health
curl -I https://sporza.ru/docs
```

## Strava webhook

После выкладки backend callback будет:

```text
https://sporza.ru/v1/strava/webhook
```

Redirect URI для Strava:

```text
https://sporza.ru/profile
```

Если webhook не создался автоматически, выполните:

```bash
curl -X POST https://sporza.ru/v1/strava/webhook/ensure
```

## Обновление

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```
