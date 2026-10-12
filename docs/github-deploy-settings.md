# GitHub settings for server deployments

Workflows use `staging` for `dev` and `production` for `main`. Configure values
under **Settings → Environments → staging/production**. Environment secrets
override repository secrets with the same name; create each environment's
credentials from its existing deployment, not by generating replacements.

## Secrets

| Name | Use |
| --- | --- |
| `AUTH_JWT_SECRET` | Stable signing key, at least 32 bytes. Separate per environment; changing it revokes sessions. |
| `DB_PASSWORD` | Existing PostgreSQL role password. Setting a new value does not rotate the password in the volume. |
| `REDIS_PASSWORD` | Redis authentication when `REDIS_AUTH_ENABLED=true`. Existing production uses explicit `false`; migration does not rotate credentials. |
| `FRP_TOKEN` | Must match the shared VPS FRP endpoint. |
| `SMTP2GO_SMTP_USERNAME`, `SMTP2GO_SMTP_PASSWORD` | Provider credentials used only by the mail relay. |
| `VPN_SUB_URL` | Required only in production, for the AI egress gateway. The URL contains credentials. |
| `GEMINI_API_KEY` | Optional AI provider key; despite its name the current Compose defaults target Groq. Staging does not inject it. |
| `YANDEX_CLIENT_SECRET`, `GH_OAUTH_CLIENT_SECRET` | Optional OAuth provider secrets. Each requires its matching Client ID. |
| `GOADMIN_PASSWORD` | Optional initial administrator password, 12–72 bytes; requires `GOADMIN_USERNAME`. Does not reset an existing account. |
| `SEED_USERS_PASSWORD` | Required only when intentionally running the production `prod-demo-users` profile. Normal deploys do not start it. |

## Variables

| Name | Default / purpose |
| --- | --- |
| `MAIL_BASE_URL` | `https://staging.realgo.dev` on staging, `https://realgo.dev` in production. Exact browser origin and email-link base. |
| `MAIL_ENABLED` | Explicit `true`/`false`; otherwise inferred from the presence of both SMTP2GO credentials in GitHub. |
| `DB_USER`, `DB_NAME` | `postgres`, `freeburger`; preserve the existing database identity. |
| `REDIS_AUTH_ENABLED` | `true` requires a Redis password. `false` explicitly preserves a deployment without Redis auth. |
| `DB_PORT`, `REDIS_PORT`, `API_PORT` | Production host ports: `5432`, `6379`, `8080`. Staging overlay fixes its ports at `5433`, `6380`, `8081`. |
| `FRP_VPS_HOST` | Existing VPS hostname/address; required. |
| `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL` | `15m`, `720h`. |
| `SMTP2GO_SMTP_HOST`, `SMTP2GO_SMTP_PORT`, `SMTP2GO_SMTP_TLS_MODE` | `mail.smtp2go.com`, `2525`, `starttls`; relay enforces STARTTLS. |
| `MAIL_SMTP_TIMEOUT` | `10s`. |
| `YANDEX_CLIENT_ID`, `GH_OAUTH_CLIENT_ID` | Public OAuth IDs, baked into the web build. Redirect URIs must use the environment's canonical origin. |
| `GOADMIN_USERNAME` | Initial administrator login. |
| `AI_MODEL`, `AI_BASE_URL` | Production defaults: `llama-3.3-70b-versatile`, `https://api.groq.com/openai/v1`. |
| `NEXT_PUBLIC_API_BASE_URL` | Empty for same-origin `/api/*` calls. Never put credentials in `NEXT_PUBLIC_*`. |
| `REALGO_EXTENSION_ORIGIN` | Public Chrome extension origin; defaults to the repository's pinned extension ID. |
| `TRUSTED_PROXY_CIDRS` | Defaults to private network ranges; narrow only after checking the actual proxy path. |
| `FSRS_REQUEST_RETENTION`, `FSRS_MAXIMUM_INTERVAL` | `0.9`, `36500`. |
| `FSRS_ENABLE_SHORT_TERM`, `FSRS_ENABLE_FUZZ` | `true`, `false`. Explicit `false` is supported. |
| `READY_TIMEOUT` | `180` seconds. |

`APP_VERSION`, `COMMIT_SHA` and `APP_ENV` come from the workflow/overlay, not
stored settings. `GH_OAUTH_*` maps to the API's `GITHUB_CLIENT_*`; GitHub
settings names cannot start with `GITHUB_`.

## Environment-only configuration

All active application inputs are stored in the corresponding GitHub
Environment. Public configuration uses Variables only; credential values use
Secrets. An unset optional input is explicitly empty, so stale values inherited
from the runner cannot enable a disabled provider. `MAIL_BASE_URL` has a
separate environment-specific default and never reads a shared repository secret.

Automated Compose commands use `--env-file /dev/null`; ignored files in a runner
checkout are not deployment dependencies. Explicit manual `.env.staging` /
`.env.production` files remain an emergency/manual option described by the runbooks.

`deploy/prepare-env.sh` checks required credentials, paired OAuth/admin inputs,
the HTTPS origin and rendered Compose configuration before changing containers.
It rejects database identity/password or Redis authentication changes that do
not match the running API. Errors contain names only, never credential values.

Both deployment workflows support a manual `mode=verify-env`: it resolves the
GitHub Environment inputs and compares API, SMTP relay, FRP and VPN credentials
against running containers without rebuilding or restarting anything. Use this
mode to verify a migration before deleting obsolete repository settings.

Migration copies existing values without rotating keys or passwords. The
existing signing key remains stable, including the shared JWT value previously
used by both deployments; storing it separately does not rotate it. OAuth/admin
credentials that were not configured remain disabled. Current environment
settings include 6 Secrets for staging, 7 for production and 24 Variables each.
Production Redis remains without authentication through the explicit mode;
introducing a password is a separate controlled credential change.

The VPS currently exposes `test.realgo.dev` as an alias of the staging backend.
It is not a separate stack. Cookie requests accept only the canonical
`MAIL_BASE_URL` origin, so an alias does not provide an independent auth origin.
Changing or redirecting the alias is a separate VPS configuration change.

## Extension signing

The private PEM used by `package:crx:mac` is outside the site deploy. If signed
CRX packaging is moved into CI, store its contents as `EXTENSION_SIGNING_KEY_PEM`
and set `REALGO_EXTENSION_KEY` to a temporary file on that runner. Do not replace
the signing key per user or release. The public `manifest.key` is not a secret.
