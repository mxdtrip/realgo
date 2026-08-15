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

## Быстрый запуск

Понадобятся Docker и Docker Compose.

```sh
cp .env.example .env
# Задайте в .env случайный AUTH_JWT_SECRET длиной не менее 32 символов.
docker compose up -d --build --wait
```

После запуска:

- web и API через Caddy: [http://localhost:8080](http://localhost:8080);
- health check: [http://localhost:8080/healthz](http://localhost:8080/healthz);
- readiness check: [http://localhost:8080/readyz](http://localhost:8080/readyz);
- презентация: [http://localhost:8080/presentation/](http://localhost:8080/presentation/).

Сервис `ready` дожидается миграций, сидеров, API, web и презентации. При
успехе он печатает `REALGO — СТЕК ПОЛНОСТЬЮ ЗАПУЩЕН`; при ошибке указывает
эндпоинт, который не ответил. Диагностика:

```sh
docker compose ps
docker compose logs ready
```

Backend можно поднять отдельно:

```sh
cd services/api
make up-api
make health
```

Полный список переменных находится в [`.env.example`](.env.example), а
серверный сценарий — в [prod-demo runbook](docs/prod-demo-deploy-runbook.md).
Секреты и локальный `.env` коммитить нельзя.

## Разработка и проверка

Основные проверки запускаются автоматически из `.github/workflows/ci.yml` для
push в `main` и `dev`, а также для pull request. CI проверяет Go build/vet/tests,
sqlc и форматирование, собирает web и расширение и запускает Playwright e2e.

Production автоматически разворачивается из `main` workflow
`deploy-prod.yml`; staging — из `dev` workflow `deploy.yml`. Перед релизом
проверяйте зелёный CI именно для выпускаемого commit SHA и состояние
[realgo.dev](https://realgo.dev).

Правила веток, коммитов и pull request описаны в
[CONTRIBUTING.md](CONTRIBUTING.md). О проблемах безопасности сообщайте по
[SECURITY.md](SECURITY.md), не через публичный issue.

## Текущие ограничения

- Генерация quiz через AI пока возвращает явный статус `not implemented`.
- Экспорт пользовательских данных пока является API-заглушкой.
- Платёжный checkout не завершает реальную оплату.
- Для production нужны серверные секреты и инфраструктура, описанные в runbook;
  обычный локальный запуск их не требует.
