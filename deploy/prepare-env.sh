#!/usr/bin/env bash
# Source from the build step so exports remain available to every Compose call.
# Non-empty GitHub inputs override runner settings. Keep an inherited setting
# until its existing value has been migrated, rather than silently clearing it.
for deploy_name in \
  DB_USER DB_PASSWORD DB_NAME DB_PORT REDIS_PASSWORD REDIS_PORT API_PORT \
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
  if [[ -n "${!deploy_input:-}" ]]; then
    export "${deploy_name}=${!deploy_input}"
  fi
  unset "$deploy_input"
done
unset deploy_name deploy_input

# This check emits names only; neither rendered Compose config nor container
# environment values are printed in Actions logs.
python3 deploy/check-env.py "$1" || return 1

# Later steps must probe the resolved port, including a runner setting that
# has not yet been migrated to a GitHub Variable.
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'REALGO_DEPLOY_API_PORT=%s\n' "${API_PORT:-8080}" >> "$GITHUB_ENV"
fi
