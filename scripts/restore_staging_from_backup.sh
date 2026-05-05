#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# DressFlow - Restaurar backup completo en DB staging local
# ==============================================================================
#
# Uso:
#   ./scripts/restore_staging_from_backup.sh backups/dressflow_prod_YYYY-MM-DD_HH-MM-SS.dump.gz
#
# Variables opcionales:
#   STAGING_DATABASE_URL=postgresql://postgres:pass@localhost:5432/dressflow_staging
#
# ==============================================================================

BACKUP_FILE="${1:-}"
STAGING_DATABASE_URL="${STAGING_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/dressflow_staging}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

[[ -n "$BACKUP_FILE" ]] || fail "Falta archivo .dump.gz"
[[ -f "$BACKUP_FILE" ]] || fail "No existe el archivo: $BACKUP_FILE"

command -v createdb >/dev/null 2>&1 || fail "createdb no está instalado"
command -v dropdb >/dev/null 2>&1 || fail "dropdb no está instalado"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore no está instalado"
command -v gunzip >/dev/null 2>&1 || fail "gunzip no está instalado"
command -v psql >/dev/null 2>&1 || fail "psql no está instalado"

DB_NAME="$(python3 - <<PY
from urllib.parse import urlparse
u=urlparse("$STAGING_DATABASE_URL")
print((u.path or '').lstrip('/'))
PY
)"

[[ -n "$DB_NAME" ]] || fail "No pude detectar nombre de DB desde STAGING_DATABASE_URL"

TMP_DUMP="/tmp/dressflow_staging_restore_$(date '+%Y-%m-%d_%H-%M-%S').dump"

log "ATENCIÓN: se va a recrear la DB local: $DB_NAME"
read -r -p "Escribí RESTORE_STAGING para continuar: " CONFIRM
[[ "$CONFIRM" == "RESTORE_STAGING" ]] || fail "Cancelado"

log "Bajando conexiones activas..."
psql "${STAGING_DATABASE_URL%/$DB_NAME}/postgres" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true

log "Recreando DB staging..."
dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

log "Descomprimiendo backup..."
gunzip -c "$BACKUP_FILE" > "$TMP_DUMP"

log "Restaurando backup completo en staging..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "$STAGING_DATABASE_URL" \
  "$TMP_DUMP"

rm -f "$TMP_DUMP"

log "Validando restore..."
psql "$STAGING_DATABASE_URL" -c "SELECT count(*) AS tenants FROM tenants;" || true

log "Restore staging finalizado OK."
