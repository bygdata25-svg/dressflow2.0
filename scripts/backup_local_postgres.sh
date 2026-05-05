#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="dressflow"
ENV_NAME="prod"
BACKUP_DIR="./backups"
KEEP_DAYS=30
ENV_FILE=""

usage() {
  cat <<EOF
Uso:
  $0 [--env .env.backup] [--dir ./backups] [--env-name prod] [--keep-days 30]

Requiere:
  DATABASE_URL="postgresql://user:pass@host:5432/dbname"

Ejemplo:
  DATABASE_URL="postgresql://..." $0

Ejemplo con env:
  $0 --env .env.backup
EOF
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="${2:-}"; shift 2 ;;
    --dir) BACKUP_DIR="${2:-}"; shift 2 ;;
    --env-name) ENV_NAME="${2:-}"; shift 2 ;;
    --keep-days) KEEP_DAYS="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Opción desconocida: $1" ;;
  esac
done

if [[ -n "$ENV_FILE" ]]; then
  [[ -f "$ENV_FILE" ]] || fail "No existe el archivo env: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

[[ -n "${DATABASE_URL:-}" ]] || fail "Falta DATABASE_URL"
command -v pg_dump >/dev/null 2>&1 || fail "pg_dump no está instalado"
command -v gzip >/dev/null 2>&1 || fail "gzip no está instalado"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BASE_NAME="${APP_NAME}_${ENV_NAME}_${TIMESTAMP}"
DUMP_FILE="${BACKUP_DIR}/${BASE_NAME}.dump"
GZ_FILE="${DUMP_FILE}.gz"
SHA_FILE="${GZ_FILE}.sha256"
LOG_FILE="${BACKUP_DIR}/${BASE_NAME}.log"

cleanup_on_error() {
  log "Fallo detectado. Limpiando archivos incompletos..." | tee -a "$LOG_FILE"
  rm -f "$DUMP_FILE" "$GZ_FILE" "$SHA_FILE"
}
trap cleanup_on_error ERR

log "Iniciando backup local de PostgreSQL..." | tee -a "$LOG_FILE"
log "Destino: $GZ_FILE" | tee -a "$LOG_FILE"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$DUMP_FILE" \
  2>>"$LOG_FILE"

[[ -s "$DUMP_FILE" ]] || fail "El archivo dump quedó vacío"

gzip -9 "$DUMP_FILE"

[[ -s "$GZ_FILE" ]] || fail "El archivo comprimido quedó vacío"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$GZ_FILE" > "$SHA_FILE"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$GZ_FILE" > "$SHA_FILE"
else
  log "Advertencia: no se encontró sha256sum/shasum. No se generó checksum." | tee -a "$LOG_FILE"
fi

SIZE="$(du -h "$GZ_FILE" | awk '{print $1}')"
log "Backup generado correctamente: $GZ_FILE ($SIZE)" | tee -a "$LOG_FILE"

log "Limpiando backups locales mayores a ${KEEP_DAYS} días..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -type f \( \
  -name "${APP_NAME}_${ENV_NAME}_*.dump.gz" -o \
  -name "${APP_NAME}_${ENV_NAME}_*.dump.gz.sha256" -o \
  -name "${APP_NAME}_${ENV_NAME}_*.log" \
\) -mtime +"$KEEP_DAYS" -print -delete >>"$LOG_FILE" 2>&1 || true

trap - ERR

cat <<EOF

Backup OK:
  Archivo:  $GZ_FILE
  Tamaño:   $SIZE
  Log:      $LOG_FILE
  Checksum: $SHA_FILE

Prueba de restore:
  gunzip -c "$GZ_FILE" > /tmp/${BASE_NAME}.dump
  pg_restore --clean --if-exists --no-owner --no-acl --dbname "\$DATABASE_URL_RESTORE" /tmp/${BASE_NAME}.dump

EOF
