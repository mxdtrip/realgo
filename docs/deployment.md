# Запуск и деплой ReAlgo

Этот документ — точка входа для всех окружений. Детали серверной инфраструктуры
находятся в отдельных staging и production runbook.

## Матрица окружений

| Параметр | Локально | Staging | Production |
| --- | --- | --- | --- |
| Git-ветка | feature-ветка | `dev` | `main` |
| Compose project | `freeburger` | `realgo-staging` | `freeburger` |
| Compose-файлы | base | base + staging overlay | base + prod overlay |
| `APP_ENV` | `local` | `staging` | `production` |
| Публичный origin | `http://localhost:8080` | `https://staging.realgo.dev` | `https://realgo.dev` |
| Регистрация | без email-подтверждения | без email-подтверждения | с email-подтверждением |
| Seed jobs | запускаются | выключены по умолчанию | контентные; `seed-users` выключен |
| Деплой | вручную | push/merge в `dev` | push/merge в `main` |

`MAIL_BASE_URL` должен точно совпадать с origin, который открыт в браузере,
включая схему и порт. Это значение используется не только в почтовых ссылках,
но и при проверке browser origin и настройке auth cookie.

## Локальная машина

```sh
cp .env.example .env
```

Заменить `AUTH_JWT_SECRET`, затем выполнить:

```sh
docker compose up -d --build --wait
docker compose logs ready
```

Если приложение открывается с другого компьютера по LAN, заменить
`MAIL_BASE_URL` на точный адрес, например `http://192.168.1.50:8080`, и
пересоздать API-контейнер.

Обычное обновление:

```sh
git pull --ff-only
docker compose up -d --build --remove-orphans --wait
```

Остановка без потери данных:

```sh
docker compose down
```

## Staging из `dev`

Рекомендуемый путь:

1. Создать feature-ветку от актуального `dev`.
2. Открыть pull request в `dev` и дождаться CI.
3. После merge workflow `deploy.yml` собирает commit из `dev` на appbox.
4. Проверить `https://staging.realgo.dev/healthz`, `/readyz` и пользовательский
   сценарий изменения.

Ручная команда использует только `.env.staging`:

```sh
docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  --profile prod-demo up -d --build --remove-orphans --wait
```

Полная настройка: [staging-deploy-runbook.md](staging-deploy-runbook.md).

## Production из `main`

Рекомендуемый путь:

1. Убедиться, что commit уже проверен на staging.
2. Открыть pull request из `dev` в `main`.
3. Дождаться CI и выполнить merge.
4. Workflow `deploy-prod.yml` собирает ровно commit из `main`.
5. Проверить `https://realgo.dev/healthz`, `/readyz` и ключевой smoke-сценарий.

Не переносите staging `.env` или секреты в production. Секреты каждого
окружения должны быть отдельными; `AUTH_JWT_SECRET` должен оставаться
стабильным внутри окружения, иначе активные сессии будут отозваны.

Для ручного запуска скопируйте `.env.production.example` в
`.env.production`, заполните все обязательные значения и укажите текущий
`COMMIT_SHA`. Этот файл игнорируется Git.

Полная настройка и rollback:
[prod-demo-deploy-runbook.md](prod-demo-deploy-runbook.md).

## Данные и миграции

- `up -d --build` и `down` сохраняют named volumes.
- `down -v` удаляет данные окружения и не используется на серверах.
- Миграции выполняются перед запуском API.
- Перед production-деплоем с новой миграцией нужен проверенный backup.
- Откат приложения сам по себе не откатывает схему БД.
- `seed-users` нельзя запускать на окружении с ценным пользовательским
  прогрессом: этот job обслуживает только одноразовые демонстрационные данные.

## Минимальная проверка после деплоя

```sh
curl -fsS https://<домен>/healthz
curl -fsS https://<домен>/readyz
curl -fsS -o /dev/null https://<домен>/
curl -fsS -o /dev/null https://<домен>/presentation/
```

После инфраструктурной проверки вручную проверить регистрацию/вход, dashboard,
roadmap, открытие задачи и прохождение карточек. Для production дополнительно
проверить отправку письма подтверждения на контролируемый адрес.
