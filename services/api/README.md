# API

Go backend-сервис.

```text
cmd/api/       точка входа и сборка зависимостей
internal/      бизнес-логика, transport, storage и интеграции
migrations/    версионируемые миграции базы данных
```

## Локальный запуск

Для запуска на хосте нужен локальный `.env`; сервис загружает его при старте.

```sh
cp .env.example .env
go run ./cmd/api
```

Для запуска через Docker Compose используйте корневой `.env.example` как шаблон:

```sh
cp ../../.env.example ../../.env
make up-api
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
```

`AUTH_JWT_SECRET` обязателен и должен быть заменён на случайное значение перед запуском.
`FRP_VPS_HOST` и `FRP_TOKEN` для локального запуска не нужны.

## Go Task

Рядом с `Makefile` есть `Taskfile.yml` с теми же базовыми командами:

```sh
task test
task up-api
task prod-demo-up
task health
```

`make up-api` / `task up-api` — backend-only dev stack: API, Postgres, Redis,
миграции и Caddy. `make up` / `task up` — полный dev stack с web.
`task prod-demo-up` — полный stack плюс `frpc` через compose profile
`prod-demo`; для него нужны `FRP_VPS_HOST` и `FRP_TOKEN`.

Если Docker пишет `permission denied`, проверьте доступ к Docker socket:
запущен ли Docker Desktop, состоит ли пользователь в `docker`, и был ли новый
терминал открыт после изменения прав.

## Swagger

После запуска API откройте `http://localhost:8080/api/docs/`.
Через существующий прокси доступен тот же путь `/api/docs/` на адресе стенда.
UI и JSON документации доступны без JWT. Защищённые API-операции требуют
`Bearer <access_token>`.
Спецификация: `/api/docs/swagger.json`. UI и JSON встроены в бинарник;
внешние CDN и валидаторы не используются. Установка отдельного Swagger-сервера
не нужна.

Документация генерируется `go-swagger` **v0.36.4** из комментариев
`swagger:operation` у HTTP-обработчиков и `swagger:model` у реальных Go DTO.
Совместимые устаревшие маршруты описаны в `internal/apidocs/aliases.go`.
Именованные обёртки для результатов, которые обработчики собирают как map,
находятся в `swagger_models.go` соответствующих пакетов.

```sh
make swagger
make swagger-validate
go test ./internal/apidocs ./cmd/swagger-normalize
```

После изменения HTTP-контракта обновите аннотации, выполните `make swagger`
и включите `internal/apidocs/swagger.json` в тот же коммит. CI выполняет
`make swagger-check`: повторную генерацию, валидацию и проверку diff.
Версии CLI и библиотеки статических UI-файлов закреплены.

Для запросов нажмите **Authorize** и вставьте полное значение
`Bearer <access_token>`, затем **Try it out → Execute** у нужной операции.
Запросы отправляются на тот же сервер, где открыта документация. Это реальные
запросы: операции создания, изменения и удаления меняют данные.
Обычный JSON-режим auth не требует `X-Realgo-Client` и `X-Realgo-Session`.
Для браузерного режима действуют описанные в Auth ограничения Origin и cookie.

### Ограничения Swagger 2.0

- Взаимоисключающие поля и условные обязательные поля сохранены в описаниях
  и `x-oneOf`/`x-anyOf`. Swagger UI не проверяет эти условия; их проверяет API.
- Для `/assistant/hint` показана JSON-схема; SSE (`stream=1`) описан в операции
  и `x-sse`. Swagger UI не заменяет клиент для чтения потока SSE.
- `/me/problem-reports` в UI использует multipart: поле `report` — JSON-текст,
  `attachment` — файл. API также принимает JSON; альтернативный контракт
  сохранён в `x-json-request-body`.
- Число или строка в диагностическом `status` — JSON scalar union. Маленькая
  команда `cmd/swagger-normalize` убирает ошибочное представление
  `json.RawMessage` как массива байтов, сохраняя описание и `x-oneOf`.
- Та же команда сохраняет ограничение длины элементов `target_topics`,
  которое сканер не переносит с Go-поля `*[]string` через `items.maxLength`.

Валидация может предупреждать о примере по умолчанию для обязательного
multipart-поля `report` и моделях JSON-альтернативы, которые используются
через расширения. Это допустимые конструкции Swagger 2.0.

## Runbooks

- [Prod-demo deploy runbook](../../docs/prod-demo-deploy-runbook.md)
- [Cabinet API contract](../../docs/cabinet-api-contract.md) — полный список endpoint'ов
  (`/me/*`, Pattern Atlas, practice hub, AI-карточки/квизы, assistant hints) с примерами
  запросов/ответов.
