# Staging deploy runbook

Общая последовательность local → staging → production описана в
[deployment.md](deployment.md). Этот runbook относится только к ветке `dev` и
серверному тестовому стенду.

Тестовый стенд ReAlgo — отдельный Compose-проект `realgo-staging`. Его
контейнеры, сеть, PostgreSQL и Redis volumes изолированы от production. На
appbox он занимает порты `127.0.0.1:5433`, `127.0.0.1:6380` и `8081`, а FRP
публикует Caddy через `https://staging.realgo.dev`.

## Рекомендуемый автоматический деплой

1. Установить на appbox Docker Engine, Compose plugin и Git. Пользователь
   self-hosted GitHub Actions runner должен иметь доступ к Docker без `sudo`.
2. Подключить runner к репозиторию с labels `self-hosted`, `linux`, `appbox`.
3. В GitHub создать Environment с именем `staging` и добавить secrets:

   - `AUTH_JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`;
   - `SMTP2GO_SMTP_USERNAME`, `SMTP2GO_SMTP_PASSWORD`;
   - `FRP_VPS_HOST`, `FRP_TOKEN`;
   - при необходимости `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`,
     `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOADMIN_USERNAME` и
     `GOADMIN_PASSWORD`.

   `AUTH_JWT_SECRET` должен быть отдельным от production и оставаться
   постоянным между сборками. Пустые обязательные secrets приводят к
   безопасной остановке compose до запуска контейнеров.
4. Убедиться, что DNS `staging.realgo.dev` указывает на VPS, а VPS edge запущен
   и проксирует FRP port `8081` согласно `deploy/vps/Caddyfile`. Значение
   `FRP_TOKEN` на VPS должно совпадать со staging secret.
5. Выполнить merge проверенной ветки в `dev`. Workflow
   `.github/workflows/deploy.yml` запустит CI, соберёт изолированный проект
   `realgo-staging` и выполнит smoke-проверки на appbox port `8081`.

Workflow намеренно получает secrets из GitHub Environment, а не из файла в
checkout: `actions/checkout` может очищать ignored-файлы рабочего каталога.

## Ручной запуск

Для аварийного или первичного ручного запуска клонировать репозиторий,
переключиться на `dev`, затем создать серверный env-файл и ограничить доступ:

```sh
cp .env.staging.example .env.staging
chmod 600 .env.staging
```

Заменить все значения `change-me`. `AUTH_JWT_SECRET`, пароли БД/Redis и
`FRP_TOKEN` должны быть случайными и постоянными. `FRP_TOKEN` должен совпадать
со значением в `deploy/vps/.env`. В `COMMIT_SHA` записать результат
`git rev-parse HEAD`. Затем проверить конфигурацию и поднять стенд:

```sh
docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo config --quiet

docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
```

Не используйте `docker compose up` без staging overlay: это поднимет локальный
проект `freeburger`, локальные порты и seed jobs вместо изолированного стенда.

## Данные

Обычная пересборка и `docker compose down` сохраняют named volumes. Никогда не
выполняйте `down -v` на тестовом сервере, если данные должны сохраниться.

Seed jobs на staging выключены по умолчанию. Для новой пустой БД контент
разрешено загрузить один раз осознанно:

```sh
cd services/api
task staging-seed
```

Не запускайте `seed-users` на стенде с пользовательским прогрессом: эта задача
может сбросить состояние демонстрационных аккаунтов. Для тестирования лучше
регистрировать отдельные аккаунты.

## Обновление

Нормальный путь — merge в `dev`: workflow `.github/workflows/deploy.yml`
проверяет CI и сам пересобирает стенд. Для ручного обновления:

```sh
git fetch origin
git switch dev
git pull --ff-only origin dev
docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
```

## Проверка

```sh
curl -fsS https://staging.realgo.dev/healthz
curl -fsS https://staging.realgo.dev/readyz
curl -fsS -o /dev/null https://staging.realgo.dev/
```

При диагностике используйте ту же команду Compose и тот же env-файл:

```sh
docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo ps

docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo logs --tail=200 api caddy frpc
```

`MAIL_BASE_URL` должен оставаться равным точному browser origin
`https://staging.realgo.dev`; схема, домен и порт участвуют в проверке CSRF и
настройке auth cookie. Изменение `AUTH_JWT_SECRET` инвалидирует все активные
сессии.
