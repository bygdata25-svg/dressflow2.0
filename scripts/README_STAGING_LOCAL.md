# DressFlow - Staging local pro

## Objetivo

Tener un entorno seguro para probar cambios sin tocar producción:

```text
Backend local  → http://localhost:8000
Frontend local → http://localhost:5173
DB local       → dressflow_staging
```

## 1. Copiar archivos

Desde este paquete:

```bash
cp .env.staging.backend /ruta/dressflow-v2/.env.staging.backend
cp .env.staging.frontend /ruta/dressflow-v2/frontend/.env.staging
cp run_staging.sh /ruta/dressflow-v2/scripts/run_staging.sh
cp restore_staging_from_backup.sh /ruta/dressflow-v2/scripts/restore_staging_from_backup.sh
chmod +x /ruta/dressflow-v2/scripts/run_staging.sh
chmod +x /ruta/dressflow-v2/scripts/restore_staging_from_backup.sh
```

## 2. Crear DB staging local

```bash
createdb dressflow_staging
```

Editá `.env.staging.backend`:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/dressflow_staging
```

Editá `frontend/.env.staging`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## 3. Restaurar datos desde backup

```bash
./scripts/restore_staging_from_backup.sh backups/dressflow_prod_YYYY-MM-DD_HH-MM-SS.dump.gz
```

Cuando pida confirmación:

```text
RESTORE_STAGING
```

## 4. Levantar staging

```bash
./scripts/run_staging.sh
```

Abrir:

```text
Backend docs: http://localhost:8000/docs
Frontend:     http://localhost:5173
```

## 5. Flujo recomendado

```text
feature nueva
  ↓
probar en staging local
  ↓
commit
  ↓
push a staging/main según corresponda
```

## Notas

- Este staging usa datos restaurados desde backup.
- No usa Render.
- No toca producción.
- Ideal para probar migraciones, reportes, UI, endpoints y bugs reales.
