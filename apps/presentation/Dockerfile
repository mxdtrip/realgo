# Runtime image for the final product presentation (apps/presentation).
#
# The deck is pure static output — hand-written HTML/CSS/JS plus media — so
# there is no build step: nginx serves the repository files as they are. It is
# kept out of the Next.js image on purpose. At ~21 MB (11 MB of that a single
# glTF model) it would otherwise be copied into apps/web/public and end up in
# every web image layer and every web deploy, for content that changes on a
# completely different cadence from the product.
#
# Publicly it is reachable at https://realgo.dev/presentation/ — Caddy strips
# the prefix and proxies here (see Caddyfile / Caddyfile.internal).

# ---- content: normalise permissions before they reach the runtime image ----
# COPY preserves the build context's file modes, and nginx's master process
# runs as root while its WORKERS run as the unprivileged `nginx` user. So a
# checkout made under a restrictive umask (0077 → files 0600, directories
# 0700) produces an image whose workers cannot read a single file:
#
#   open() "/usr/share/nginx/html/index.html" failed (13: Permission denied)
#
# Git only records the executable bit, never the read bits, so whether this
# happens depends on the umask of whoever cloned — exactly the kind of
# environment-dependent build the image should not have. `a+rX` fixes it
# deterministically: capital X adds execute to directories only, so they stay
# traversable while files stay non-executable.
#
# This runs in a throwaway stage rather than as a `RUN chmod` in the final
# image on purpose: chmod rewrites metadata for every file, which would make
# overlayfs copy up all ~21 MB into a second layer and double the image. Here
# the final image gets one already-correct content layer instead.
#
# The stage reuses the nginx base image rather than pulling a second one: it is
# already being fetched for the runtime stage below, so this costs no extra
# download and no extra cache entry.
FROM nginx:1.27-alpine AS content
WORKDIR /content
COPY index.html apple.css deck.js macbook-3d.js ./
COPY assets ./assets
COPY vendor ./vendor
RUN chmod -R a+rX /content

# ---- runtime ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=content /content /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
