#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_FILE="${1:-}"

fail() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$BACKUP_FILE" ]] || fail "Falta archivo backup .dump.gz"
[[ -f "$BACKUP_FILE" ]] || fail "No existe el archivo: $BACKUP_FILE"
[[ -n "${DATABASE_URL_RESTORE:-}" ]] || fail "Falta DATABASE_URL_RESTORE"

command -v pg_restore >/dev/null 2>&1 || fail "pg_restore no está instalado"
command -v gunzip >/dev/null 2>&1 || fail "gunzip no está instalado"

TMP_DUMP="/tmp/dressflow_restore_$(date '+%Y-%m-%d_%H-%M-%S').dump"

echo "Descomprimiendo backup..."
gunzip -c "$BACKUP_FILE" > "$TMP_DUMP"

echo "Restaurando en base destino..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "$DATABASE_URL_RESTORE" \
  "$TMP_DUMP"

rm -f "$TMP_DUMP"

echo "Restore finalizado OK."
