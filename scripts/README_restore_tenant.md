# DressFlow - Restore por tenant

## Concepto

No se restaura directo desde el `.dump.gz` a producción.

Flujo correcto:

```text
backup completo
   ↓
restore a DB temporal
   ↓
extraer un tenant
   ↓
insertar en DB destino
```

## Instalar dependencia

```bash
pip install "psycopg[binary]"
```

## 1. Restaurar backup completo a DB temporal

```bash
createdb dressflow_restore_tmp

gunzip -c backups/dressflow_prod_YYYY-MM-DD_HH-MM-SS.dump.gz > /tmp/dressflow_restore.dump

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "postgresql://USER:PASS@localhost:5432/dressflow_restore_tmp" \
  /tmp/dressflow_restore.dump
```

## 2. Dry-run

```bash
python scripts/restore_tenant.py \
  --source-url "postgresql://USER:PASS@localhost:5432/dressflow_restore_tmp" \
  --target-url "postgresql://USER:PASS@HOST:5432/dressflow_target" \
  --tenant-id "TENANT_UUID" \
  --dry-run
```

## 3. Restore real

Primero probalo en staging.

```bash
python scripts/restore_tenant.py \
  --source-url "postgresql://USER:PASS@localhost:5432/dressflow_restore_tmp" \
  --target-url "postgresql://USER:PASS@HOST:5432/dressflow_target" \
  --tenant-id "TENANT_UUID" \
  --execute
```

El script pide escribir:

```text
RESTORE_TENANT
```

## Notas

- Detecta tablas con columna `tenant_id`.
- Borra datos actuales del tenant en target.
- Inserta datos del tenant desde la DB temporal.
- No toca tablas sin `tenant_id`.
- Para incluir la fila de `public.tenants`, agregá `--include-tenant-row`.
- Para saltear tablas:

```bash
--skip-tables "audit_logs,impersonation_audit"
```
