// ReAlgo API.
//
// Документация HTTP API, собранная из аннотаций обработчиков и Go DTO.
// В Authorize вводите полное значение Bearer <access_token>. Запросы идут
// на тот же сервер, с которого открыта документация. Браузерные cookie-сессии
// описаны в Auth; для обычной проверки используйте JSON refresh_token.
// Успешные JSON-ответы имеют обёртку data/meta, ошибки — error/meta.
// X-Request-Id также передаётся в meta.requestId. Стандартный лимит JSON
// тела — 1 MiB; у диагностических отчётов — 2 MiB. OPTIONS обслуживает прокси.
//
// Swagger 2.0 не выражает oneOf/anyOf и несколько схем тела для разных MIME.
// Эти случаи описаны текстом и расширениями x-oneOf/x-anyOf/x-sse/
// x-json-request-body; реальные ограничения проверяются HTTP-обработчиками.
//
// BasePath: /
// Version: dev-swagger
// Consumes:
//   - application/json
//
// Produces:
//   - application/json
//
// SecurityDefinitions:
//
//	BearerAuth:
//	  type: apiKey
//	  in: header
//	  name: Authorization
//	  description: Введите полное значение Bearer <access_token>.
//
// swagger:meta
package apidocs
