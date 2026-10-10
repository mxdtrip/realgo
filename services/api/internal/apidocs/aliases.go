package apidocs

// swagger:operation GET /api/v1/patterns Patterns get_api_v1_patterns
//
// ---
// summary: "Получить паттерны со статистикой"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns. Ответ: data.patterns, а не data-массив. Параметр sort не обрабатывается этим handler."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/patternList"}
//   "401": {$ref: "#/responses/unauthorized"}
//   "500": {$ref: "#/responses/internalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/patterns/atlas Patterns get_api_v1_patterns_atlas
//
// ---
// summary: "Получить Pattern Atlas с company overlay"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns/atlas. Получить Pattern Atlas с company overlay. В проверенном коммите после Bearer-авторизации нет проверки тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/patternAtlas"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/patterns/atlas/companies Patterns get_api_v1_patterns_atlas_companies
//
// ---
// summary: "Получить компании с evidence в атласе"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns/atlas/companies. Получить компании с evidence в атласе. В проверенном коммите после Bearer-авторизации нет проверки тарифа Pro; ошибка 403 pro_required из новых ТЗ этим маршрутом не реализована."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/atlasCompanies"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/patterns/atlas/{code} Patterns get_api_v1_patterns_atlas_code
//
// ---
// summary: "Получить семейство или субпаттерн атласа"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns/atlas/{code}. Получить семейство или субпаттерн атласа."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/patternNode"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/patterns/weak Patterns get_api_v1_patterns_weak
//
// ---
// summary: "Получить слабые паттерны"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns/weak. Получить слабые паттерны."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/weakPatterns"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/patterns/{code} Patterns get_api_v1_patterns_code
//
// ---
// summary: "Получить материал по паттерну"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me/patterns/{code}. Получить материал по паттерну."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/patternDetail"}
//   "401": {$ref: "#/responses/authUnauthorized"}
//   "404": {$ref: "#/responses/authNotFound"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}

// swagger:operation GET /api/v1/users/me Account get_api_v1_users_me
//
// ---
// summary: "Получить текущего пользователя"
// description: "Старый совместимый алиас. Новый адрес: /api/v1/me. Получить текущего пользователя."
// security:
// - BearerAuth: []
// deprecated: true
// responses:
//   "200": {$ref: "#/responses/userDataResponse"}
//   "401": {$ref: "#/responses/invalidAuthSession"}
//   "500": {$ref: "#/responses/authInternalError"}
//   "503": {$ref: "#/responses/authUnavailable"}
//   "504": {$ref: "#/responses/gatewayTimeout"}
