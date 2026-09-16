<p align="center">
  <a href="https://realgo.dev">
    <img src="apps/web/public/icons/realgo-logo.png" width="112" alt="ReAlgo logo" />
  </a>
</p>

<h1 align="center">ReAlgo</h1>

<p align="center">
  Память для подготовки к техническим интервью: решайте задачи, фиксируйте результат и возвращайтесь к нему в нужный момент.
</p>

<p align="center">
  <a href="https://realgo.dev">Сайт</a> ·
  <a href="https://realgo.dev/docs">Документация</a> ·
  <a href="https://realgo.dev/presentation/">Презентация</a> ·
  <a href="https://t.me/realgo_devlog">Devlog</a>
</p>

<p align="center">
  <a href="https://github.com/mxdtrip/realgo/actions/workflows/ci.yml"><img src="https://github.com/mxdtrip/realgo/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://realgo.dev"><img src="https://img.shields.io/website?url=https%3A%2F%2Frealgo.dev&label=realgo.dev" alt="realgo.dev status" /></a>
</p>

## О продукте

Один раз решить алгоритмическую задачу недостаточно: без повторения подход
забывается как раз к собеседованию. ReAlgo замыкает полный цикл подготовки:

1. Браузерное расширение распознаёт задачу и результат отправки на LeetCode,
   HackerRank, GeeksforGeeks и Codeforces.
2. Пользователь оценивает, насколько легко далось решение.
3. FSRS планирует следующее повторение: сложные задачи возвращаются раньше,
   уверенно решённые — позже.
4. Pattern Atlas связывает практику с 22 семействами и 111 субпаттернами.
5. Персональный roadmap учитывает дату интервью, выбранные компании,
   доступное время и пробелы в знаниях.
6. AI-помощник даёт поэтапные подсказки и создаёт карточки, не подменяя
   самостоятельное решение готовым ответом.

ReAlgo — активно развиваемый продукт. Production доступен на
[realgo.dev](https://realgo.dev), а история разработки публикуется в
[@realgo_devlog](https://t.me/realgo_devlog).

## Состав монорепозитория

```text
.
├── apps/
│   ├── web/                 # Next.js 16, React 19, TypeScript, PWA
│   ├── extension/           # Plasmo, TypeScript, Manifest V3
│   └── presentation/        # Автономный HTML-дек в nginx-контейнере
├── services/
│   └── api/                 # Go 1.25, chi, pgx, sqlc, FSRS
│       ├── cmd/api/         # Точка входа API
│       ├── internal/        # Предметные модули
│       ├── migrations/      # SQL-миграции golang-migrate
│       └── seeds/           # Идемпотентные сидеры контента
├── docs/                    # API-контракт и runbook деплоя
└── packages/                # Общие UI, типы и конфигурация
```

Клиенты используют единый API. Backend — модульный монолит с PostgreSQL и
Redis; основные предметные области: auth, cards, companies, dashboard,
extension, patterns, practice, problems, quiz, roadmap и scheduler.

Подробности по компонентам:

- [Web](apps/web/README.md)
- [Browser Extension](apps/extension/README.md)
- [Go API](services/api/README.md)
- [Presentation](apps/presentation/README.md)
- [Backend API contract](docs/cabinet-api-contract.md)

## Окружения и ветки

В проекте используются три независимых окружения:

| Окружение | Источник | Compose | Адрес |
| --- | --- | --- | --- |
| Локальное | текущая feature-ветка | `docker-compose.yml` | `http://localhost:8080` |
| Тестовый стенд | ветка `dev` | base + `docker-compose.staging.yml` | `https://staging.realgo.dev` |
| Production | ветка `main` | base + `docker-compose.prod.yml` | `https://realgo.dev` |

Изменения проходят один маршрут:

```text
feature-ветка → pull request в dev → staging → pull request в main → production
```

Не запускайте серверные окружения обычной командой `docker compose up`: без
overlay-файла она поднимает локальный стек с локальными настройками и seed
jobs. Полная схема окружений приведена в
[руководстве по запуску и деплою](docs/deployment.md).

## Локальный запуск

Понадобятся Docker Engine и Docker Compose plugin.

```sh
cp .env.example .env
```

В `.env` обязательно замените `AUTH_JWT_SECRET` на случайную строку длиной не
менее 32 символов. Для стандартного запуска оставьте:

```env
APP_ENV=local
MAIL_BASE_URL=http://localhost:8080
MAIL_ENABLED=false
```

Запустите весь стек из корня репозитория:

```sh
docker compose up -d --build --wait
docker compose logs ready
```

После запуска доступны:

- приложение: [http://localhost:8080](http://localhost:8080);
- health check: [http://localhost:8080/healthz](http://localhost:8080/healthz);
- readiness check: [http://localhost:8080/readyz](http://localhost:8080/readyz);
- презентация: [http://localhost:8080/presentation/](http://localhost:8080/presentation/).

Сервис `ready` ждёт завершения миграций и seed jobs, затем проверяет API, web и
презентацию. Для диагностики:

```sh
docker compose ps
docker compose logs --tail=200 api web caddy ready
```

Остановить контейнеры без удаления данных:

```sh
docker compose down
```

Не используйте `docker compose down -v`, если хотите сохранить локальную БД.
Локальный `seed-users` может возвращать демонстрационные аккаунты к исходному
состоянию; для проверки сохранения прогресса используйте отдельно
зарегистрированный аккаунт.

## Тестовый стенд: `dev`

Merge в `dev` автоматически запускает CI и workflow
`.github/workflows/deploy.yml`. Стенд разворачивается как отдельный Compose-
проект `realgo-staging`, поэтому его контейнеры и volumes не пересекаются с
production.

Серверные secrets хранятся в GitHub Environment `staging`; `.env.staging` в
Git не добавляется. Для ручного запуска используется шаблон
[`.env.staging.example`](.env.staging.example):

```sh
cp .env.staging.example .env.staging
# заполнить все change-me и указать COMMIT_SHA
docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
```

Подготовка runner, GitHub secrets, FRP, обновление и диагностика описаны в
[staging runbook](docs/staging-deploy-runbook.md).

## Production: `main`

В production попадает только уже проверенный на staging код. Merge из `dev` в
`main` запускает CI и `.github/workflows/deploy-prod.yml`; успешный workflow
пересобирает production Compose-проект и выполняет smoke-проверки.

Production обязательно использует `APP_ENV=production`, стабильный
`AUTH_JWT_SECRET`, `MAIL_BASE_URL=https://realgo.dev` и отдельные пароли БД и
Redis. Для ручного запуска используйте
[`.env.production.example`](.env.production.example). Seed демонстрационных
пользователей в штатный deploy не входит.

Инфраструктура VPS, обязательные secrets, ручной deploy, healthcheck и rollback
описаны в [production runbook](docs/prod-demo-deploy-runbook.md).

## Разработка и проверки

CI запускается для pull request и push в `dev`/`main`. Он проверяет Go
build/vet/tests, sqlc и форматирование, собирает web и расширение, запускает
Playwright e2e и валидирует Compose-конфигурации.

Перед merge убедитесь, что зелёный CI относится к нужному commit SHA. Правила
веток, коммитов и pull request описаны в [CONTRIBUTING.md](CONTRIBUTING.md).
Секреты, `.env`, `.env.staging` и другие локальные env-файлы коммитить нельзя.
О проблемах безопасности сообщайте по [SECURITY.md](SECURITY.md), а не через
публичный issue.

## Текущие ограничения

- Генерация quiz через AI пока возвращает явный статус `not implemented`.
- Экспорт пользовательских данных пока является API-заглушкой.
- Платёжный checkout не завершает реальную оплату.
- Для production нужны серверные секреты и инфраструктура, описанные в runbook;
  обычный локальный запуск их не требует.
