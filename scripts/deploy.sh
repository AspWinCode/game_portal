#!/usr/bin/env bash
# deploy.sh — first-time and subsequent deploys to the VPS.
# Run as root (or a user in the docker group) on the VPS.
#
# Usage:
#   bash scripts/deploy.sh           # full deploy (build + migrate + start)
#   bash scripts/deploy.sh --update  # redeploy without re-running certbot

set -euo pipefail

DOMAIN="djam.tirskix.space"
EMAIL="${CERTBOT_EMAIL:-}"          # set CERTBOT_EMAIL env var or edit here
COMPOSE="docker compose -f docker-compose.prod.yml"

# ── helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[deploy] $*"; }
die()  { echo "[deploy] ERROR: $*" >&2; exit 1; }

require_env() {
  [[ -f .env.prod ]] || die ".env.prod not found — copy .env.prod.example and fill in secrets."
  # shellcheck source=/dev/null
  set -a; source .env.prod; set +a
  [[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD must be set in .env.prod"
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
    return
  fi
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
}

# ── main ──────────────────────────────────────────────────────────────────────
UPDATE_ONLY="${1:-}"
cd "$(dirname "$0")/.."   # repo root

require_env
install_docker

# ── SSL certificate (first time only) ─────────────────────────────────────────
if [[ "$UPDATE_ONLY" != "--update" ]]; then
  if [[ ! -f "/var/lib/docker/volumes/game-game_certbot_certs/_data/live/${DOMAIN}/fullchain.pem" ]]; then
    [[ -n "$EMAIL" ]] || die "Set CERTBOT_EMAIL before the first deploy: CERTBOT_EMAIL=you@example.com bash scripts/deploy.sh"

    log "Starting nginx with HTTP-only config for ACME challenge..."
    cp nginx/nginx.init.conf nginx/nginx.conf.active 2>/dev/null || true
    cp nginx/nginx.init.conf nginx/nginx.conf

    $COMPOSE up -d nginx certbot

    log "Requesting Let's Encrypt certificate for ${DOMAIN}..."
    $COMPOSE run --rm certbot certbot certonly \
      --webroot -w /var/www/certbot \
      --email "$EMAIL" \
      --agree-tos \
      --no-eff-email \
      -d "$DOMAIN"

    log "Certificate obtained. Switching to HTTPS config..."
    cp nginx/nginx.init.conf nginx/nginx.init.conf.bak 2>/dev/null || true
    # restore the real nginx.conf (HTTPS) from git / original file
    git checkout -- nginx/nginx.conf 2>/dev/null || \
      cp nginx/nginx.conf.ssl nginx/nginx.conf 2>/dev/null || true
  else
    log "Certificate already present — skipping certbot."
  fi
fi

# ── build & start all services ────────────────────────────────────────────────
log "Building images..."
$COMPOSE build --pull

log "Starting infrastructure (postgres)..."
$COMPOSE up -d postgres
log "Waiting for postgres to be ready..."
sleep 5

log "Running Prisma migrations..."
$COMPOSE run --rm api sh -c "
  cd /app/apps/api &&
  npx prisma migrate deploy
"

log "Starting all services..."
$COMPOSE up -d

log "Reloading nginx..."
$COMPOSE exec nginx nginx -s reload 2>/dev/null || true

log ""
log "✓ Deployed to https://${DOMAIN}"
log "  API health: https://${DOMAIN}/api/health/details"
