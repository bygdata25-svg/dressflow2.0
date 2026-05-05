#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# DressFlow - Staging local
# ==============================================================================
#
# Uso:
#   ./scripts/run_staging.sh
#
# Qué hace:
#   - valida DB local
#   - levanta backend FastAPI en localhost:8000
#   - levanta frontend Vite en localhost:5173
#
# Requisitos:
#   - PostgreSQL local
#   - Node/npm
#   - Python/venv del backend
#
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/.env.staging.backend}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-$FRONTEND_DIR/.env.staging}"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -d "$BACKEND_DIR" ]] || fail "No existe backend dir: $BACKEND_DIR"
[[ -d "$FRONTEND_DIR" ]] || fail "No existe frontend dir: $FRONTEND_DIR"
[[ -f "$BACKEND_ENV_FILE" ]] || fail "No existe $BACKEND_ENV_FILE. Copiá .env.staging.backend"
[[ -f "$FRONTEND_ENV_FILE" ]] || fail "No existe $FRONTEND_ENV_FILE. Copiá .env.staging.frontend a frontend/.env.staging"

set -a
# shellcheck disable=SC1090
source "$BACKEND_ENV_FILE"
set +a

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL vacío en $BACKEND_ENV_FILE"

command -v psql >/dev/null 2>&1 || fail "psql no está instalado"
command -v npm >/dev/null 2>&1 || fail "npm no está instalado"

log "Validando conexión DB staging..."
psql "$DATABASE_URL" -c "SELECT current_database(), now();" >/dev/null

cleanup() {
  log "Cerrando procesos..."
  jobs -p | xargs -r kill || true
}
trap cleanup EXIT INT TERM

log "Levantando backend staging en http://localhost:${BACKEND_PORT}"
cd "$BACKEND_DIR"

if [[ -d ".venv" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [[ -d "venv" ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!

sleep 3

log "Levantando frontend staging en http://localhost:${FRONTEND_PORT}"
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

log "Staging local iniciado."
log "Backend:  http://localhost:${BACKEND_PORT}/docs"
log "Frontend: http://localhost:${FRONTEND_PORT}"
log "Presioná CTRL+C para cerrar."

wait
