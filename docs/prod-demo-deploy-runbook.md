# Production deploy runbook

Runbook для production ReAlgo из ветки `main`: backend API, web, Caddy,
Postgres, Redis и reverse tunnel через `deploy/vps`. Общая последовательность
local → staging → production описана в [deployment.md](deployment.md).

## Схема

- Local stack: корневой `docker-compose.yml` поднимает `api` (собственная
  сеть), `web`, `presentation`, `caddy`, `postgres`, `redis`, миграции и seed
  jobs — без VPS tunnel и без vpngw. Обычный `docker compose up` этого файла
  достаточно.
- Production: base + overlay `docker-compose.prod.yml` (vpngw; api переезжает
  в его network namespace; caddy монтирует `Caddyfile.internal.prod`) +
  профиль `prod-demo` для `frpc`.
- VPS edge: `deploy/vps/docker-compose.yml` поднимает `frps` и публичный Caddy.
- TLS завершается на VPS Caddy. Home Caddy получает plain HTTP через frp и
  роутит `/api/*` в api (`api:8080` в dev, `vpngw:8080` на сервере — см.
  `Caddyfile.internal.prod`), `/presentation/*` в `presentation:80` со
  снятием префикса (`handle_path`), остальное в `web:3000`.
- `presentation` — статический дек (`apps/presentation`) в собственном nginx.
  Он намеренно не входит в netns `vpngw`: исходящих запросов у него нет.
  Caddy зависит от него через `depends_on` без условия по health — сервис
  всегда поднимается вместе со стеком, но сломанный дек роняет только
  `/presentation/` в 502, а не весь реверс-прокси.
- Публичный VPS edge отвечает `404` на `/admin` и `/admin/*`. GoAdmin остаётся
  доступным только из внутреннего home stack; для работы с ним используйте SSH
  port-forward до home/appbox host.

Профиль Compose по историческим причинам называется `prod-demo`, но текущий
workflow использует его для штатного production-деплоя.

## Рекомендуемый автоматический деплой

Production не собирается из feature-ветки или напрямую из `dev`:

1. Commit должен пройти CI и пользовательскую проверку на staging.
2. Открывается pull request из `dev` в `main`.
3. После merge workflow `.github/workflows/deploy-prod.yml` повторно запускает
   CI и собирает точный commit из `main` на self-hosted runner `appbox`.
4. Workflow пересоздаёт Caddy и проверяет маршрутизацию презентации и AI.

Workflow напрямую читает следующие GitHub repository secrets:

| Переменная | Назначение |
| --- | --- |
| `AUTH_JWT_SECRET` | Подпись сессий; изменение завершит все активные сессии. |
| `FRP_VPS_HOST`, `FRP_TOKEN` | Туннель между appbox и VPS edge. |
| `VPN_SUB_URL` | Исходящий tunnel API для AI-провайдера. |
| `SMTP2GO_SMTP_USERNAME`, `SMTP2GO_SMTP_PASSWORD` | Транзакционная почта. |

`GEMINI_API_KEY` и `SEED_USERS_PASSWORD` опциональны. `DB_PASSWORD` и
`REDIS_PASSWORD` текущий workflow получает из постоянного environment процесса
self-hosted runner; для существующего PostgreSQL volume пароль должен совпадать
с реальным паролем роли. OAuth и GoAdmin также настраиваются в окружении runner,
если соответствующие возможности включены. Секреты production не должны
совпадать со staging.

`APP_ENV=production` и `MAIL_BASE_URL=https://realgo.dev` задаются production
overlay/workflow. Не меняйте их на staging-значения.

## Локальный запуск для проверки production-ветки

```sh
cp .env.example .env
# заменить AUTH_JWT_SECRET на случайную строку 32+ символа
docker compose up -d --build --wait
docker compose logs ready
```

Ручные `curl` по `/healthz` и `/readyz` больше не нужны как первый шаг: их уже
делает сервис `ready`. Он стартует последним в графе (после миграций и всех
seed-джобов), дожидается ответов от `/healthz`, `/readyz`, лендинга и
`/presentation/` — и печатает рамку `REALGO — СТЕК ПОЛНОСТЬЮ ЗАПУЩЕН`,
отделённую пустыми строками от остальных логов. Если ответа нет, он вместо
рамки сообщает, какой эндпоинт молчит, и выходит с кодом 1 — в
`docker compose ps` это видно как `Exited (1)`. Таймаут задаётся
`READY_TIMEOUT` (по умолчанию 180 с).

`docker compose up -d --wait` держит команду до появления баннера, что удобно
в скриптах: код возврата тогда отражает готовность всего стека.

`FRP_VPS_HOST`, `FRP_TOKEN` и `VPN_SUB_URL` для локального запуска не нужны.

Из backend-директории можно использовать Makefile или go-task:

```sh
cd services/api
make up
make logs

task up
task health
```

## Production env и secrets для ручного запуска

Создать отдельный `.env.production` из production-шаблона на home stack:

```sh
cp .env.production.example .env.production
chmod 600 .env.production
```

Обязательные значения для production:

| Key | Где | Требование |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | home `.env.production` | Случайная строка минимум 32 символа; не placeholder. |
| `DB_PASSWORD` | home `.env.production` | Сильный пароль; для существующего volume — текущий пароль роли. |
| `REDIS_PASSWORD` | home `.env.production` | Случайный непустой пароль. |
| `FRP_VPS_HOST` | home `.env.production` | Публичный IP или hostname VPS. |
| `FRP_TOKEN` | home `.env.production`, VPS `.env` | Один и тот же случайный shared token. |
| `VPN_SUB_URL` | home `.env.production` / secret | VLESS-подписка для vpngw; без неё overlay не отрезолвится и vpngw/api не стартуют. |
| `SMTP2GO_SMTP_USERNAME`, `SMTP2GO_SMTP_PASSWORD` | home `.env.production` | Учётные данные почтового relay. |

Production-значения, которые оставляем явно:

| Key | Где | Значение |
| --- | --- | --- |
| `REALGO_SITE_ADDRESS` | home/VPS env | `realgo.dev`. |
| `MAIL_BASE_URL` | home `.env.production` | Ровно `https://realgo.dev`. |
| `REALGO_EXTENSION_ORIGIN` | home `.env.production` | Chrome extension origin из packaged extension. |
| `NEXT_PUBLIC_API_BASE_URL` | home `.env.production` | Пусто для same-origin `/api/*`. |
| `TRUSTED_PROXY_CIDRS` | home `.env.production` | CIDR trusted proxy, если включаем X-Forwarded-For trust. |

Не коммитить `.env.production`, токены, приватные ключи расширения и server
secrets.

## Deploy

VPS edge:

```sh
cd deploy/vps
cp .env.example .env
# заменить FRP_TOKEN
docker compose up -d
docker compose ps
```

Home stack — ручной fallback, штатный deploy выполняет GitHub Actions:

```sh
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo config --quiet

docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
```

Не выполняйте `down -v`: команда удалит production volumes. Перед deploy с
новыми миграциями сделайте и проверьте backup PostgreSQL.

## Healthcheck

Локально на home stack:

```sh
curl -fsS http://localhost:${API_PORT:-8080}/healthz
curl -fsS http://localhost:${API_PORT:-8080}/readyz
```

Через публичный домен:

```sh
curl -fsS https://realgo.dev/healthz
curl -fsS https://realgo.dev/readyz
# Auth-only проверка extension status (не public healthcheck):
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://realgo.dev/api/v1/me/extension/status
```

Expected:

- `/healthz` возвращает `{"status":"ok"}`.
- `/readyz` возвращает `{"status":"ready"}`.
- `docker compose ps` показывает `api`, `vpngw`, `web`, `presentation`,
  `caddy`, `frpc`, `postgres`, `redis` как running/healthy; `migrate` завершен
  успешно.
- Презентация отвечает по обоим путям:

```sh
# Голый путь обязан отдавать 308 на слэш-вариант: без него относительные
# ассеты дека и его importmap для Three.js резолвятся от корня сайта.
curl -sS -o /dev/null -w '%{http_code}\n' https://realgo.dev/presentation
# Вложенный ассет, а не только index.html: SPA-фолбэк nginx отдал бы
# index.html с кодом 200 и на неверно снятом префиксе.
curl -fsS -o /dev/null -w '%{http_code}\n' \
  https://realgo.dev/presentation/vendor/three/three.module.min.js
```

Если публичный healthcheck не проходит:

```sh
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo logs -f caddy frpc api
```

На VPS edge:

```sh
cd deploy/vps
docker compose logs -f caddy frps
```

Проверить по порядку: DNS `REALGO_SITE_ADDRESS` указывает на VPS, `FRP_TOKEN`
совпадает на обеих сторонах, `FRP_VPS_HOST` доступен с home stack, `frpc`
зарегистрировал proxy `realgo-web`, `api` проходит `/readyz` локально.

## Admin access

GoAdmin не публикуется в интернет. Публичные проверки должны возвращать `404`:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://realgo.dev/admin
curl -sS -o /dev/null -w '%{http_code}\n' https://staging.realgo.dev/admin
```

Для доступа откройте SSH tunnel до host, где запущен home stack:

```sh
ssh -N -L 18080:127.0.0.1:8080 <user>@<home-or-appbox-host>
```

После этого админка доступна локально:

```text
http://localhost:18080/admin
```

Для входа задайте `GOADMIN_USERNAME` и `GOADMIN_PASSWORD` в
`.env.production`. Пароль должен быть случайным и не короче 12 байт; не
храните его в Git.

## Smoke после деплоя

Миграции и штатные контентные seed jobs уже входят в Compose dependency graph;
не запускайте локальные Taskfile-команды поверх production вручную. Проверьте
`/healthz`, `/readyz`, вход, dashboard, roadmap, открытие задачи и карточки.

`seed-users` не входит в production smoke: prod overlay помещает его в
отдельный профиль `prod-demo-users`, потому что job сбрасывает данные demo
email. Запускать его только для одноразового/диспозабельного демо с явно
заданным `SEED_USERS_PASSWORD`:

```sh
SEED_USERS_PASSWORD='<strong-demo-password>' docker compose \
  --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo-users run --rm seed-users
```

Затем пройти демо-сценарий из `DEMO.md`: login, extension event, dashboard,
review attempt, weak patterns.

## Rollback

Rollback приложения выполняется на заранее записанный release SHA, а не на
текущее состояние `main`:

```sh
git fetch --all --tags
git switch --detach "$RELEASE_SHA"
# Обновить COMMIT_SHA в .env.production на RELEASE_SHA.
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
curl -fsS http://localhost:${API_PORT:-8080}/readyz
```

Этот шаг не откатывает БД. Перед миграциями нужен backup/restore plan; если
новая миграция несовместима со старым бинарником, сначала восстановить БД из
проверенного backup либо применить отдельно подготовленную forward-fix
миграцию, и только затем переключать трафик.

Для VPS edge rollback обычно не нужен: edge stack не содержит app code. Если
менялись `deploy/vps/*`, вернуть предыдущую версию директории и выполнить
`docker compose up -d`.
