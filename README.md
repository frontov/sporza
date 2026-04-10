# Sporza MVP

Стартовая foundation-база и рабочий skeleton для спортивной социальной платформы под российский рынок.

Проект спроектирован как:

- `web-first`
- `mobile-first UX`
- `API-first backend`
- готовый к будущему мобильному приложению без смены core-архитектуры

## Что входит в foundation

- архитектурный blueprint MVP
- первичная схема данных PostgreSQL/PostGIS
- черновой OpenAPI-контракт для ключевых пользовательских сценариев
- локальная инфраструктура через Docker Compose
- монорепо-структура под `Next.js` и `NestJS`
- backend skeleton c базовыми модулями NestJS
- frontend skeleton c mobile-first страницами по разделам MVP
- import pipeline через `S3-compatible storage + BullMQ + Redis`

## Структура

```text
apps/
  api/                  NestJS backend skeleton
  web/                  Next.js frontend skeleton
docs/
  api/openapi.yaml      REST API контракт MVP
  db/schema.sql         Схема БД PostgreSQL/PostGIS
  mvp-architecture.md   Архитектура, модули, потоки и roadmap
package.json            Workspaces и общие команды
docker-compose.yml      Локальные сервисы: Postgres, Redis, MinIO
docker-compose.prod.yml Production override для `sporza.ru`
deploy/Caddyfile        Reverse proxy и TLS
deploy/DEPLOY.md        Инструкция выкладки на сервер
```

## Основные продуктовые модули MVP

- Auth
- Profile
- Activities
- Import jobs
- Feed
- Follows
- Clubs
- Events
- Notifications
- Admin

## Быстрый старт

1. Поднять стек в Docker:

```bash
docker compose up -d
```

2. Установить зависимости:

```bash
npm install
```

3. Или запускать приложения локально без Docker:

```bash
npm run dev:api
npm run dev:web
```

4. Дальше можно последовательно:

- наполнять `apps/api` реальными сервисами, DTO и persistence-слоем
- подключать `apps/web` к API и переводить страницы с mock на живые данные
- генерировать DTO и SDK из [`docs/api/openapi.yaml`](/Users/roman/Documents/sporza/docs/api/openapi.yaml)
- переносить [`docs/db/schema.sql`](/Users/roman/Documents/sporza/docs/db/schema.sql) в миграции ORM или SQL-миграции

На текущем этапе защищённые backend endpoints уже работают через `Authorization: Bearer <accessToken>`.
Глобальный JWT guard валидирует access token и активную session в БД, а admin-ручки дополнительно проверяют роль.

Импорт файлов уже проходит через базовый асинхронный pipeline:

- файл сохраняется в S3-compatible storage
- в PostgreSQL создаётся `import_job`
- в BullMQ ставится задача на обработку
- processor создаёт activity и связывает её с исходным файлом

Текущий parser intentionally lightweight: он создаёт activity на основе минимально извлечённых данных из файла и готов к следующему шагу, где можно подключать полноценный `FIT/GPX/TCX` parsing.

## Принятые допущения

- основной клиент на первом этапе только web
- события импортируются из внешних источников батчами и хранятся локально
- активности импортируются из файлов `FIT`, `GPX`, `TCX`, без собственного GPS-трекинга
- рекомендации, чат, сегменты и биллинг намеренно исключены из MVP

## Следующий практический шаг

Оптимальная следующая итерация:

1. подключить persistence-слой к `apps/api`
2. расширить `activities/imports/events` очередями, storage и фоновой обработкой
3. после этого подключить `feed`, `clubs`, `notifications` и продвинутую admin-модерацию

## Production deploy

Файлы для публикации на домен уже подготовлены:

- [docker-compose.yml](/Users/roman/Documents/sporza/docker-compose.yml)
- [docker-compose.prod.yml](/Users/roman/Documents/sporza/docker-compose.prod.yml)
- [deploy/Caddyfile](/Users/roman/Documents/sporza/deploy/Caddyfile)
- [deploy/DEPLOY.md](/Users/roman/Documents/sporza/deploy/DEPLOY.md)
