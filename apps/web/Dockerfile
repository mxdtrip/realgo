# Production image for the realgo Next.js app (apps/web).
#
# Multi-stage build that emits Next's `standalone` output, so the final image
# ships only the server bundle + traced node_modules (no full dev deps). The
# app talks to the Go API over same-origin `/api/*` — Caddy routes that path to
# the api container — so NEXT_PUBLIC_API_BASE_URL is baked empty (relative URLs)
# by default and needs no per-environment change.

# ---- deps: install node_modules from the lockfile ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone server bundle ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time. Empty = relative same-origin
# API calls (https://realgo.dev/api/v1/...), which is what the tunnel setup uses.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_APP_VERSION=""
ARG NEXT_PUBLIC_COMMIT_SHA=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Resolve release metadata inside the build so the ordinary compose command is
# sufficient. `repository_metadata` is a named BuildKit context limited by the
# repository-root .dockerignore to HEAD/refs/packed-refs; none of it is copied
# into an image layer. Explicit CI args still take precedence.
RUN --mount=from=repository_metadata,target=/repository-metadata,ro \
    set -eu; \
    commit="$NEXT_PUBLIC_COMMIT_SHA"; \
    if [ -z "$commit" ]; then \
      git_dir=/repository-metadata/.git; \
      head_value="$(tr -d '\r\n' < "$git_dir/HEAD")"; \
      case "$head_value" in \
        "ref: "*) \
          git_ref="${head_value#ref: }"; \
          if [ -f "$git_dir/$git_ref" ]; then \
            commit="$(tr -d '\r\n' < "$git_dir/$git_ref")"; \
          elif [ -f "$git_dir/packed-refs" ]; then \
            commit="$(awk -v ref="$git_ref" '$2 == ref { print $1; exit }' "$git_dir/packed-refs")"; \
          fi \
          ;; \
        *) commit="$head_value" ;; \
      esac; \
    fi; \
    commit="$(printf '%s' "$commit" | tr 'A-F' 'a-f')"; \
    case "$commit" in ''|*[!0-9a-f]*) echo 'Unable to resolve a valid commit SHA' >&2; exit 1;; esac; \
    if [ "${#commit}" -ne 40 ] && [ "${#commit}" -ne 64 ]; then \
      echo "Unexpected commit SHA length: ${#commit}" >&2; exit 1; \
    fi; \
    release="$NEXT_PUBLIC_APP_VERSION"; \
    if [ -z "$release" ]; then release="git-$(printf '%.12s' "$commit")"; fi; \
    echo "Building web release $release ($commit)"; \
    NEXT_PUBLIC_APP_VERSION="$release" NEXT_PUBLIC_COMMIT_SHA="$commit" npm run build
# public/ is the only thing the runner copies that carries the build context's
# file modes verbatim (everything under .next/ is generated here, so it already
# has sane ones). The runner drops to the unprivileged `nextjs` user, so a
# checkout made under a restrictive umask — 0077 gives files 0600, directories
# 0700 — would ship static assets the server cannot read, and every image and
# icon would fail at runtime. Git records only the executable bit, never the
# read bits, so whether that happens depends on who cloned the repo. Normalise
# here, in a stage that is not shipped: capital X adds execute to directories
# only, keeping them traversable without marking files executable.
RUN chmod -R a+rX public

# ---- runner: minimal runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN useradd --create-home --shell /usr/sbin/nologin nextjs
# Standalone output: server.js + traced deps at the root, plus the static assets
# and public/ which Next does NOT bundle and must be copied alongside.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
