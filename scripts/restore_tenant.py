#!/usr/bin/env python3
from __future__ import annotations
from psycopg.types.json import Jsonb

import argparse
import os
import sys
from collections import defaultdict, deque
from dataclasses import dataclass

try:
    import psycopg
    from psycopg import sql
    from psycopg.types.json import Jsonb
except ImportError:
    print('ERROR: instalá psycopg: pip install "psycopg[binary]"', file=sys.stderr)
    raise


@dataclass(frozen=True)
class TableRef:
    schema: str
    name: str

    @property
    def fq(self) -> str:
        return f"{self.schema}.{self.name}"


SYSTEM_SKIP = {"alembic_version", "spatial_ref_sys"}


def args_parser():
    p = argparse.ArgumentParser(description="DressFlow - restore por tenant")
    p.add_argument("--source-url", default=os.getenv("SOURCE_DATABASE_URL"))
    p.add_argument("--target-url", default=os.getenv("TARGET_DATABASE_URL"))
    p.add_argument("--tenant-id", default=os.getenv("TENANT_ID"))
    p.add_argument("--schema", default="public")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--execute", action="store_true")
    p.add_argument("--include-tenant-row", action="store_true")
    p.add_argument("--include-users", action="store_true", default=True)
    p.add_argument("--no-include-users", action="store_false", dest="include_users")
    p.add_argument("--skip-tables", default="")
    a = p.parse_args()

    if not a.source_url:
        p.error("Falta --source-url o SOURCE_DATABASE_URL")
    if not a.target_url:
        p.error("Falta --target-url o TARGET_DATABASE_URL")
    if not a.tenant_id:
        p.error("Falta --tenant-id o TENANT_ID")
    if a.source_url == a.target_url:
        p.error("SOURCE y TARGET no pueden ser la misma base")
    if a.dry_run and a.execute:
        p.error("Usá --dry-run o --execute, no ambos")
    if not a.dry_run and not a.execute:
        p.error("Tenés que indicar --dry-run o --execute")
    return a


def qtable(t: TableRef):
    return sql.SQL(".").join([sql.Identifier(t.schema), sql.Identifier(t.name)])


def adapt_value(value):
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


def table_exists(conn, t: TableRef) -> bool:
    return bool(conn.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema=%s AND table_name=%s AND table_type='BASE TABLE'
        """,
        (t.schema, t.name),
    ).fetchone())


def column_exists(conn, t: TableRef, column: str) -> bool:
    return bool(conn.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema=%s AND table_name=%s AND column_name=%s
        """,
        (t.schema, t.name, column),
    ).fetchone())


def get_tenant_tables(conn, schema: str, skip: set[str]) -> list[TableRef]:
    rows = conn.execute(
        """
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema=%s AND column_name='tenant_id'
        GROUP BY table_schema, table_name
        ORDER BY table_name
        """,
        (schema,),
    ).fetchall()

    return [
        TableRef(s, n)
        for s, n in rows
        if n not in SYSTEM_SKIP and n not in skip
    ]


def get_columns(conn, t: TableRef) -> list[str]:
    rows = conn.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema=%s
          AND table_name=%s
          AND is_generated='NEVER'
        ORDER BY ordinal_position
        """,
        (t.schema, t.name),
    ).fetchall()
    return [r[0] for r in rows]


def tenant_exists(conn, tenant_id: str) -> bool:
    if not table_exists(conn, TableRef("public", "tenants")):
        return True
    return bool(conn.execute("SELECT 1 FROM public.tenants WHERE id=%s", (tenant_id,)).fetchone())


def count_rows(conn, t: TableRef, tenant_id: str) -> int:
    q = sql.SQL("SELECT count(*) FROM {} WHERE tenant_id=%s").format(qtable(t))
    return int(conn.execute(q, (tenant_id,)).fetchone()[0])


def fk_edges(conn, selected: set[TableRef]):
    rows = conn.execute(
        """
        SELECT
            child_ns.nspname AS child_schema,
            child.relname AS child_table,
            parent_ns.nspname AS parent_schema,
            parent.relname AS parent_table
        FROM pg_constraint c
        JOIN pg_class child ON child.oid=c.conrelid
        JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
        JOIN pg_class parent ON parent.oid=c.confrelid
        JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
        WHERE c.contype='f'
        """
    ).fetchall()

    edges = []
    for cs, ct, ps, pt in rows:
        child = TableRef(cs, ct)
        parent = TableRef(ps, pt)
        if child in selected and parent in selected and child != parent:
            edges.append((parent, child))
    return edges


def topo_sort(tables: list[TableRef], edges):
    indegree = {t: 0 for t in tables}
    children = defaultdict(list)

    for parent, child in edges:
        children[parent].append(child)
        indegree[child] += 1

    q = deque([t for t in tables if indegree[t] == 0])
    out = []

    while q:
        node = q.popleft()
        out.append(node)
        for child in children[node]:
            indegree[child] -= 1
            if indegree[child] == 0:
                q.append(child)

    if len(out) != len(tables):
        print("ADVERTENCIA: no se pudo ordenar por FK completamente. Uso orden alfabético.")
        return tables

    return out


def delete_rows(conn, t: TableRef, tenant_id: str) -> int:
    q = sql.SQL("DELETE FROM {} WHERE tenant_id=%s").format(qtable(t))
    cur = conn.execute(q, (tenant_id,))
    return cur.rowcount


def fetch_rows(conn, t: TableRef, columns: list[str], tenant_id: str):
    q = sql.SQL("SELECT {} FROM {} WHERE tenant_id=%s").format(
        sql.SQL(", ").join(sql.Identifier(c) for c in columns),
        qtable(t),
    )
    with conn.cursor() as cur:
        cur.execute(q, (tenant_id,))
        yield from cur


def insert_rows(conn, t: TableRef, columns: list[str], rows) -> int:
    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)
    q = sql.SQL("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT DO NOTHING").format(
        qtable(t),
        sql.SQL(", ").join(sql.Identifier(c) for c in columns),
        placeholders,
    )
    count = 0
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(q, tuple(adapt_value(v) for v in row))
            count += cur.rowcount
    return count


def restore_tenant_row(source, target, tenant_id: str):
    t = TableRef("public", "tenants")
    if not table_exists(source, t) or not table_exists(target, t):
        print("No existe public.tenants en source o target. Se omite.")
        return

    cols = get_columns(source, t)
    q = sql.SQL("SELECT {} FROM public.tenants WHERE id=%s").format(
        sql.SQL(", ").join(sql.Identifier(c) for c in cols)
    )
    row = source.execute(q, (tenant_id,)).fetchone()
    if not row:
        print("Tenant row no encontrada en source. Se omite.")
        return

    target.execute("DELETE FROM public.tenants WHERE id=%s", (tenant_id,))
    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in cols)
    iq = sql.SQL("INSERT INTO public.tenants ({}) VALUES ({}) ON CONFLICT DO NOTHING").format(
        sql.SQL(", ").join(sql.Identifier(c) for c in cols),
        placeholders,
    )
    target.execute(iq, tuple(adapt_value(v) for v in row))
    print("  RESTORE public.tenants: 1")


def get_user_related_tables(conn, schema: str, skip: set[str]) -> list[TableRef]:
    rows = conn.execute(
        """
        SELECT c1.table_schema, c1.table_name
        FROM information_schema.columns c1
        JOIN information_schema.columns c2
          ON c2.table_schema = c1.table_schema
         AND c2.table_name = c1.table_name
        WHERE c1.table_schema=%s
          AND c1.column_name='tenant_id'
          AND c2.column_name='user_id'
        GROUP BY c1.table_schema, c1.table_name
        ORDER BY c1.table_name
        """,
        (schema,),
    ).fetchall()

    return [
        TableRef(s, n)
        for s, n in rows
        if n not in SYSTEM_SKIP and n not in skip
    ]


def get_user_ids_for_tenant(conn, schema: str, tenant_id: str, skip: set[str]) -> set[str]:
    user_ids: set[str] = set()

    for t in get_user_related_tables(conn, schema, skip):
        q = sql.SQL("SELECT DISTINCT user_id FROM {} WHERE tenant_id=%s AND user_id IS NOT NULL").format(qtable(t))
        rows = conn.execute(q, (tenant_id,)).fetchall()
        for (uid,) in rows:
            user_ids.add(str(uid))

    return user_ids


def fetch_user_rows(conn, user_ids: set[str]):
    users_t = TableRef("public", "users")
    if not user_ids or not table_exists(conn, users_t):
        return [], []

    cols = get_columns(conn, users_t)
    q = sql.SQL("SELECT {} FROM public.users WHERE id = ANY(%s)").format(
        sql.SQL(", ").join(sql.Identifier(c) for c in cols)
    )
    rows = conn.execute(q, (list(user_ids),)).fetchall()
    return cols, rows


def restore_users_for_tenant(source, target, schema: str, tenant_id: str, skip: set[str]):
    users_t = TableRef("public", "users")

    if not table_exists(source, users_t) or not table_exists(target, users_t):
        print("Tabla public.users no existe en source o target. Se omite restore de users.")
        return

    user_ids = get_user_ids_for_tenant(source, schema, tenant_id, skip)

    if not user_ids:
        print("No se detectaron users relacionados al tenant.")
        return

    cols, rows = fetch_user_rows(source, user_ids)

    if not rows:
        print("Se detectaron user_id relacionados, pero no se encontraron filas en public.users.")
        return

    pk = "id"
    update_cols = [c for c in cols if c != pk]

    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in cols)
    columns_sql = sql.SQL(", ").join(sql.Identifier(c) for c in cols)

    if update_cols:
        set_sql = sql.SQL(", ").join(
            sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(c), sql.Identifier(c))
            for c in update_cols
        )
        q = sql.SQL("INSERT INTO public.users ({}) VALUES ({}) ON CONFLICT (id) DO UPDATE SET {}").format(
            columns_sql, placeholders, set_sql
        )
    else:
        q = sql.SQL("INSERT INTO public.users ({}) VALUES ({}) ON CONFLICT (id) DO NOTHING").format(
            columns_sql, placeholders
        )

    affected = 0
    with target.cursor() as cur:
        for row in rows:
            cur.execute(q, tuple(adapt_value(v) for v in row))
            affected += cur.rowcount

    print(f"  RESTORE public.users: {affected} usuario(s) insertados/actualizados")


def main() -> int:
    a = args_parser()
    skip = {x.strip() for x in a.skip_tables.split(",") if x.strip()}

    print("DressFlow restore por tenant")
    print(f"Tenant: {a.tenant_id}")
    print(f"Modo: {'EXECUTE' if a.execute else 'DRY-RUN'}")
    print(f"Include users: {a.include_users}")
    print()

    with psycopg.connect(a.source_url) as source, psycopg.connect(a.target_url) as target:
        if not tenant_exists(source, a.tenant_id):
            print("ERROR: tenant no existe en source", file=sys.stderr)
            return 1

        source_tables = get_tenant_tables(source, a.schema, skip)
        target_tables = [t for t in source_tables if table_exists(target, t)]

        user_ids = get_user_ids_for_tenant(source, a.schema, a.tenant_id, skip) if a.include_users else set()

        order = topo_sort(target_tables, fk_edges(source, set(target_tables)))
        delete_order = list(reversed(order))

        print("Tablas con tenant_id:")
        total_source = 0
        total_target = 0
        for t in order:
            sc = count_rows(source, t, a.tenant_id)
            tc = count_rows(target, t, a.tenant_id)
            total_source += sc
            total_target += tc
            print(f"  {t.fq:45s} source={sc:6d} target={tc:6d}")

        print()
        print(f"Total source: {total_source}")
        print(f"Total target actual: {total_target}")
        if a.include_users:
            print(f"Usuarios relacionados detectados: {len(user_ids)}")

        if a.dry_run:
            print("\nDRY-RUN OK. No se modificó nada.")
            return 0

        confirm = input("\nEscribí RESTORE_TENANT para continuar: ").strip()
        if confirm != "RESTORE_TENANT":
            print("Cancelado.")
            return 1

        try:
            with target.transaction():
                print("\nBorrando datos actuales del tenant...")
                for t in delete_order:
                    n = delete_rows(target, t, a.tenant_id)
                    if n:
                        print(f"  DELETE {t.fq}: {n}")

                print("\nRestaurando dependencias compartidas...")
                if a.include_tenant_row:
                    restore_tenant_row(source, target, a.tenant_id)

                if a.include_users:
                    restore_users_for_tenant(source, target, a.schema, a.tenant_id, skip)

                print("\nInsertando datos del tenant desde backup restaurado...")
                for t in order:
                    cols = get_columns(source, t)
                    n = insert_rows(target, t, cols, fetch_rows(source, t, cols, a.tenant_id))
                    if n:
                        print(f"  INSERT {t.fq}: {n}")

            print("\nRestore por tenant finalizado OK.")
            return 0
        except Exception as exc:
            print("\nERROR. Transacción revertida.", file=sys.stderr)
            print(str(exc), file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
