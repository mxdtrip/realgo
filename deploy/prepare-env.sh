#!/usr/bin/env bash
# Source from the build step so exports remain available to every Compose call.
# Every application setting comes from the selected GitHub Environment.
# Explicitly clear missing inputs so obsolete runner values cannot re-enable
# disabled providers or alter an environment's database/Redis configuration.
for deploy_name in \
  DB_USER DB_PASSWORD DB_NAME DB_PORT REDIS_PASSWORD REDIS_AUTH_ENABLED REDIS_PORT API_PORT \
  AUTH_JWT_SECRET AUTH_ACCESS_TTL AUTH_REFRESH_TTL FRP_VPS_HOST FRP_TOKEN \
  SEED_USERS_PASSWORD GEMINI_API_KEY AI_MODEL AI_BASE_URL MAIL_ENABLED \
  MAIL_BASE_URL MAIL_SMTP_TIMEOUT SMTP2GO_SMTP_HOST SMTP2GO_SMTP_PORT \
  SMTP2GO_SMTP_TLS_MODE SMTP2GO_SMTP_USERNAME SMTP2GO_SMTP_PASSWORD \
  YANDEX_CLIENT_ID YANDEX_CLIENT_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET \
  GOADMIN_USERNAME GOADMIN_PASSWORD VPN_SUB_URL TRUSTED_PROXY_CIDRS \
  REALGO_EXTENSION_ORIGIN NEXT_PUBLIC_API_BASE_URL FSRS_REQUEST_RETENTION \
  FSRS_MAXIMUM_INTERVAL FSRS_ENABLE_SHORT_TERM FSRS_ENABLE_FUZZ READY_TIMEOUT
do
  deploy_input="DEPLOY_${deploy_name}"
  export "${deploy_name}=${!deploy_input:-}"
  unset "$deploy_input"
done
unset deploy_name deploy_input
export REDIS_AUTH_ENABLED="${REDIS_AUTH_ENABLED:-true}"

# Production currently runs Redis without auth. This explicit mode preserves
# that configuration; enabling auth requires an actual password in Secrets.
if [[ "${REDIS_AUTH_ENABLED}" == false ]]; then
  export REDIS_PASSWORD=""
fi

# This check emits names only; neither rendered Compose config nor container
# environment values are printed in Actions logs.
if [[ "${2:-}" == verify-secrets ]]; then
  python3 deploy/check-env.py "$1" --verify-secrets || return 1
else
  python3 deploy/check-env.py "$1" || return 1
fi

# Later steps must probe the resolved port, including a runner setting that
# has not yet been migrated to a GitHub Variable.
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'REALGO_DEPLOY_API_PORT=%s\n' "${API_PORT:-8080}" >> "$GITHUB_ENV"
fi
