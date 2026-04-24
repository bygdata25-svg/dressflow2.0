from io import BytesIO
from decimal import Decimal
from datetime import date, datetime
import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from sqlalchemy import text, select, or_, desc
from sqlalchemy.orm import Session
from app.api.deps import get_current_membership

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.dress_sale import DressSale
from app.models.dress import Dress
from app.models.customer import Customer
from app.models.accessory_sale import AccessorySale
from app.models.accessory import Accessory

router = APIRouter(prefix="/reports", tags=["reports"])


# =========================================================
# HELPERS
# =========================================================

def _excel_response(workbook: Workbook, filename: str) -> StreamingResponse:
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _apply_header_style(ws, headers: list[str]) -> None:
    ws.append(headers)

    header_fill = PatternFill("solid", fgColor="3D3648")
    header_font = Font(color="FFFFFF", bold=True)

    for col_idx, _header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")


def _movement_type_label(value: str | None) -> str:
    raw = (value or "").upper()
    if raw == "IN":
        return "Entrada"
    if raw == "OUT":
        return "Salida"
    if raw == "ADJUST":
        return "Ajuste"
    return value or ""


def _loan_status_label(value: str | None) -> str:
    raw = (value or "").upper()
    if raw == "ACTIVE":
        return "Activo"
    if raw == "LATE":
        return "Vencido"
    if raw == "RETURNED":
        return "Devuelto"
    return value or ""


def _loan_status_fill(value: str | None) -> PatternFill:
    raw = (value or "").upper()
    if raw == "ACTIVE":
        return PatternFill("solid", fgColor="ECFDF3")
    if raw == "LATE":
        return PatternFill("solid", fgColor="FDECEC")
    if raw == "RETURNED":
        return PatternFill("solid", fgColor="F4F4F5")
    return PatternFill("solid", fgColor="FFFFFF")


def _loan_status_font(value: str | None) -> Font:
    raw = (value or "").upper()
    if raw == "ACTIVE":
        return Font(color="027A48", bold=True)
    if raw == "LATE":
        return Font(color="B42318", bold=True)
    if raw == "RETURNED":
        return Font(color="52525B", bold=True)
    return Font(color="000000")


def _sale_status_label(value: str | None) -> str:
    raw = (value or "").upper()
    if raw == "COMPLETED":
        return "Completada"
    if raw == "CANCELLED":
        return "Cancelada"
    return value or ""


def _sale_status_fill(value: str | None) -> PatternFill:
    raw = (value or "").upper()
    if raw == "COMPLETED":
        return PatternFill("solid", fgColor="ECFDF3")
    if raw == "CANCELLED":
        return PatternFill("solid", fgColor="F4F4F5")
    return PatternFill("solid", fgColor="FFFFFF")


def _sale_status_font(value: str | None) -> Font:
    raw = (value or "").upper()
    if raw == "COMPLETED":
        return Font(color="027A48", bold=True)
    if raw == "CANCELLED":
        return Font(color="52525B", bold=True)
    return Font(color="000000")

def _payment_method_label(value: str | None) -> str:
    raw = (value or "").upper().strip()
    if raw == "CASH":
        return "EFECTIVO"
    if raw == "TRANSFER":
        return "TRANSFERENCIA"
    if raw == "CARD":
        return "TARJETA DE CREDITO"
    if raw == "MERCADOPAGO":
        return "MERCADO PAGO"
    return value or ""


def _fabric_movement_note(row) -> str | None:
    """
    Devuelve una nota legible para reportes de movimientos de tela.
    En salidas por producción, prioriza la orden de producción por sobre el texto técnico.
    """
    movement_reason = (row["movement_reason"] or "").upper()
    reference = row["reference"]

    if movement_reason == "PRODUCTION_ISSUE" and reference:
        ref = str(reference).replace("Production Order", "").strip()
        return f"Orden de producción {ref}" if ref else "Orden de producción"

    if movement_reason == "PRODUCTION_RETURN" and reference:
        ref = str(reference).replace("Production Order", "").strip()
        return f"Devolución de producción {ref}" if ref else "Devolución de producción"

    return row["notes"]


# =========================================================
# STOCK VALORIZADO
# =========================================================

def _build_stock_valuation_query(search: str | None = None):
    sql = """
        SELECT
            f.id,
            f.name,
            f.color,
            COALESCE(SUM(fr.current_length - fr.reserved_length), 0) AS total_stock_meters,
            COALESCE(
                SUM(
                    (fr.current_length - fr.reserved_length) * COALESCE(fr.price_per_meter, 0)
                ),
                0
            ) AS total_value
        FROM fabrics f
        LEFT JOIN fabric_rolls fr
            ON fr.fabric_id = f.id
           AND fr.deleted_at IS NULL
           AND fr.status = 'AVAILABLE'
        WHERE f.tenant_id = :tenant_id
          AND f.deleted_at IS NULL
    """

    params: dict[str, object] = {}

    if search:
        sql += """
          AND (
            LOWER(f.name) LIKE :search
            OR LOWER(COALESCE(f.color, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    sql += """
        GROUP BY f.id, f.name, f.color
        ORDER BY f.name ASC, f.color ASC
    """

    return text(sql), params


@router.get("/stock-valuation")
def stock_valuation_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
):
    sql, extra_params = _build_stock_valuation_query(search=search)

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    items = []
    grand_total = Decimal("0")

    for row in rows:
        total_value = Decimal(str(row["total_value"] or 0))
        total_stock_meters = Decimal(str(row["total_stock_meters"] or 0))
        grand_total += total_value

        average_price = (
            float(total_value / total_stock_meters)
            if total_stock_meters > 0
            else 0
        )

        items.append(
            {
                "id": str(row["id"]),
                "name": row["name"],
                "color": row["color"],
                "total_stock_meters": float(total_stock_meters),
                "average_price_per_meter": average_price,
                "total_value": float(total_value),
            }
        )

    return {
        "items": items,
        "total": len(items),
        "grand_total": float(grand_total),
    }


@router.get("/stock-valuation/export")
def export_stock_valuation_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
):
    sql, extra_params = _build_stock_valuation_query(search=search)

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Stock valorizado"

    headers = [
        "Tela",
        "Color",
        "Stock disponible (mts)",
        "Precio promedio x metro",
        "Valor total",
    ]
    _apply_header_style(ws, headers)

    grand_total = Decimal("0")

    for row in rows:
        total_value = Decimal(str(row["total_value"] or 0))
        total_stock_meters = Decimal(str(row["total_stock_meters"] or 0))
        grand_total += total_value

        average_price = (
            float(total_value / total_stock_meters)
            if total_stock_meters > 0
            else 0
        )

        ws.append(
            [
                row["name"],
                row["color"],
                float(total_stock_meters),
                average_price,
                float(total_value),
            ]
        )

    total_row_idx = ws.max_row + 2
    ws.cell(row=total_row_idx, column=4, value="TOTAL")
    ws.cell(row=total_row_idx, column=4).font = Font(bold=True)
    ws.cell(row=total_row_idx, column=5, value=float(grand_total))
    ws.cell(row=total_row_idx, column=5).font = Font(bold=True)

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=3, max_col=5):
        for cell in row:
            cell.number_format = "#,##0.00"

    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 22
    ws.column_dimensions["E"].width = 18

    return _excel_response(wb, "stock_valorizado.xlsx")


# =========================================================
# MOVIMIENTOS DE TELA
# =========================================================

def _build_fabric_movements_query(
    search: str | None = None,
    movement_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    sql = """
        SELECT
            fm.id,
            fm.created_at,
            fm.type,
            fm.quantity,
            fm.reference,
            fm.notes,
            fm.movement_reason,
            fr.roll_code,
            f.name AS fabric_name,
            f.color AS fabric_color
        FROM fabric_movements fm
        LEFT JOIN fabric_rolls fr
            ON fr.id = fm.fabric_roll_id
        LEFT JOIN fabrics f
            ON f.id = fr.fabric_id
        WHERE fm.tenant_id = :tenant_id
    """

    params: dict[str, object] = {}

    if movement_type:
        sql += " AND fm.type = :movement_type"
        params["movement_type"] = movement_type.strip().upper()

    if date_from:
        sql += " AND DATE(fm.created_at) >= :date_from"
        params["date_from"] = date_from

    if date_to:
        sql += " AND DATE(fm.created_at) <= :date_to"
        params["date_to"] = date_to

    if search:
        sql += """
          AND (
            LOWER(COALESCE(f.name, '')) LIKE :search
            OR LOWER(COALESCE(f.color, '')) LIKE :search
            OR LOWER(COALESCE(fr.roll_code, '')) LIKE :search
            OR LOWER(COALESCE(fm.notes, '')) LIKE :search
            OR LOWER(COALESCE(fm.reference, '')) LIKE :search
            OR LOWER(COALESCE(fm.movement_reason, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    sql += """
        ORDER BY fm.created_at DESC
    """

    return text(sql), params


@router.get("/fabric-movements")
def fabric_movements_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_fabric_movements_query(
        search=search,
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    items = [
        {
            "id": str(row["id"]),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "type": row["type"],
            "quantity": float(row["quantity"] or 0),
            "reference": row["reference"],
            "notes": _fabric_movement_note(row),
            "movement_reason": row["movement_reason"],
            "fabric_name": row["fabric_name"],
            "fabric_color": row["fabric_color"],
            "roll_code": row["roll_code"],
        }
        for row in rows
    ]

    return {
        "items": items,
        "total": len(items),
    }


@router.get("/fabric-movements/export")
def export_fabric_movements_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_fabric_movements_query(
        search=search,
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Movimientos tela"

    headers = [
        "Fecha",
        "Tipo",
        "Tela",
        "Color",
        "Rollo",
        "Cantidad",
        "Referencia",
        "Motivo",
        "Notas",
    ]
    _apply_header_style(ws, headers)

    for row in rows:
        ws.append(
            [
                row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else "",
                _movement_type_label(row["type"]),
                row["fabric_name"],
                row["fabric_color"],
                row["roll_code"],
                float(row["quantity"] or 0),
                row["reference"],
                row["movement_reason"],
                _fabric_movement_note(row),
            ]
        )

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=6, max_col=6):
        for cell in row:
            cell.number_format = "#,##0.00"

    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 28
    ws.column_dimensions["D"].width = 18
    ws.column_dimensions["E"].width = 18
    ws.column_dimensions["F"].width = 14
    ws.column_dimensions["G"].width = 22
    ws.column_dimensions["H"].width = 20
    ws.column_dimensions["I"].width = 30

    return _excel_response(wb, "movimientos_tela.xlsx")


# =========================================================
# PRESTAMOS / ALQUILERES
# =========================================================

def _loan_type_label(value: str | None) -> str:
    raw = (value or "").upper()
    if raw == "RENTAL":
        return "Alquiler"
    return "Préstamo"


def _build_loans_query(
    search: str | None = None,
    status: str | None = None,
    loan_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    sql = """
        SELECT
            l.id,
            l.start_date,
            l.expected_return_date,
            l.actual_return_date,
            l.status,
            l.loan_type,
            l.amount,
            l.notes,
            d.code AS dress_code,
            d.name AS dress_name,
            COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name
        FROM loans l
        LEFT JOIN dresses d
            ON d.id = l.dress_id
        LEFT JOIN customers c
            ON c.id = l.customer_id
        WHERE l.tenant_id = :tenant_id
          AND l.deleted_at IS NULL
    """

    params: dict[str, object] = {}

    if date_from:
        sql += " AND DATE(l.start_date) >= :date_from"
        params["date_from"] = date_from

    if date_to:
        sql += " AND DATE(l.start_date) <= :date_to"
        params["date_to"] = date_to

    if search:
        sql += """
          AND (
            LOWER(COALESCE(d.code, '')) LIKE :search
            OR LOWER(COALESCE(d.name, '')) LIKE :search
            OR LOWER(COALESCE(c.first_name, '')) LIKE :search
            OR LOWER(COALESCE(c.last_name, '')) LIKE :search
            OR LOWER(COALESCE(l.notes, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    if loan_type:
        sql += " AND l.loan_type = :loan_type"
        params["loan_type"] = loan_type.strip().upper()

    if status:
        normalized_status = status.strip().upper()

        if normalized_status == "RETURNED":
            sql += " AND l.actual_return_date IS NOT NULL"
        elif normalized_status == "LATE":
            sql += """
              AND l.actual_return_date IS NULL
              AND l.expected_return_date IS NOT NULL
              AND l.expected_return_date < CURRENT_DATE
            """
        elif normalized_status == "ACTIVE":
            sql += """
              AND l.actual_return_date IS NULL
              AND (
                l.expected_return_date IS NULL
                OR l.expected_return_date >= CURRENT_DATE
              )
            """
        else:
            sql += " AND l.status = :status"
            params["status"] = normalized_status

    sql += """
        ORDER BY l.start_date DESC, l.expected_return_date DESC
    """

    return text(sql), params


@router.get("/loans")
def loans_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    loan_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_loans_query(
        search=search,
        status=status,
        loan_type=loan_type,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    items = []
    today = date.today()

    for row in rows:
        actual_return_date = row["actual_return_date"]
        expected_return_date = row["expected_return_date"]

        if actual_return_date:
            effective_status = "RETURNED"
        elif expected_return_date and expected_return_date < today:
            effective_status = "LATE"
        else:
            effective_status = "ACTIVE"

        items.append(
            {
                "id": str(row["id"]),
                "start_date": row["start_date"].isoformat() if row["start_date"] else None,
                "expected_return_date": expected_return_date.isoformat() if expected_return_date else None,
                "actual_return_date": actual_return_date.isoformat() if actual_return_date else None,
                "status": row["status"],
                "effective_status": effective_status,
                "loan_type": row["loan_type"] or "LOAN",
                "amount": float(row["amount"]) if row["amount"] is not None else None,
                "customer_name": row["customer_name"].strip() if row["customer_name"] else "",
                "notes": row["notes"],
                "dress_code": row["dress_code"],
                "dress_name": row["dress_name"],
            }
        )

    return {
        "items": items,
        "total": len(items),
    }


@router.get("/loans/export")
def export_loans_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    loan_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_loans_query(
        search=search,
        status=status,
        loan_type=loan_type,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Prestamos y alquileres"

    headers = [
        "Tipo",
        "Fecha inicio",
        "Fecha vencimiento",
        "Fecha devolucion",
        "Estado",
        "Vestido codigo",
        "Vestido nombre",
        "Cliente",
        "Valor",
        "Notas",
    ]
    _apply_header_style(ws, headers)

    today = date.today()

    for row in rows:
        customer_name = row["customer_name"].strip() if row["customer_name"] else ""
        actual_return_date = row["actual_return_date"]
        expected_return_date = row["expected_return_date"]

        if actual_return_date:
            effective_status = "RETURNED"
        elif expected_return_date and expected_return_date < today:
            effective_status = "LATE"
        else:
            effective_status = "ACTIVE"

        ws.append(
            [
                _loan_type_label(row["loan_type"]),
                row["start_date"].strftime("%Y-%m-%d") if row["start_date"] else "",
                expected_return_date.strftime("%Y-%m-%d") if expected_return_date else "",
                actual_return_date.strftime("%Y-%m-%d") if actual_return_date else "",
                _loan_status_label(effective_status),
                row["dress_code"],
                row["dress_name"],
                customer_name,
                float(row["amount"]) if row["amount"] is not None else None,
                row["notes"],
            ]
        )

        status_cell = ws.cell(row=ws.max_row, column=5)
        status_cell.fill = _loan_status_fill(effective_status)
        status_cell.font = _loan_status_font(effective_status)
        status_cell.alignment = Alignment(horizontal="center", vertical="center")

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=9, max_col=9):
        for cell in row:
            if isinstance(cell.value, (int, float)):
                cell.number_format = "#,##0.00"

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 18
    ws.column_dimensions["D"].width = 18
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 18
    ws.column_dimensions["G"].width = 24
    ws.column_dimensions["H"].width = 28
    ws.column_dimensions["I"].width = 16
    ws.column_dimensions["J"].width = 32

    return _excel_response(wb, "prestamos_alquileres.xlsx")


# =========================================================
# COSTOS DE PRODUCCION
# =========================================================

def _build_production_costs_query(
    search: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    sql = """
        SELECT
            po.id,
            po.order_number,
            COALESCE(po.target_dress_name, '-') AS target_dress_name,
            COALESCE(po.target_dress_code, '-') AS target_dress_code,
            COALESCE(s.name, '-') AS workshop_supplier_name,
            po.status,
            po.priority,
            po.due_date,
            po.planned_quantity,
            po.produced_quantity,
            COALESCE(po.labor_cost, 0) AS labor_cost,
            COALESCE(po.additional_cost, 0) AS additional_cost,
            COALESCE(po.currency, 'USD') AS currency,

            COALESCE(
                SUM(
                    COALESCE(m.planned_quantity, 0) * COALESCE(m.unit_cost_snapshot, 0)
                ),
                0
            ) AS estimated_material_cost,

            COALESCE(
                SUM(
                    (
                        COALESCE(m.delivered_quantity, 0)
                        - COALESCE(m.returned_quantity, 0)
                        - COALESCE(m.waste_quantity, 0)
                    ) * COALESCE(m.unit_cost_snapshot, 0)
                ),
                0
            ) AS actual_material_cost

        FROM production_orders po
        LEFT JOIN suppliers s
            ON s.id = po.workshop_supplier_id
        LEFT JOIN production_order_materials m
            ON m.production_order_id = po.id

        WHERE po.tenant_id = :tenant_id
          AND po.deleted_at IS NULL
    """

    params: dict[str, object] = {}

    if status:
        sql += " AND po.status = :status"
        params["status"] = status.strip().upper()

    if date_from:
        sql += " AND DATE(po.due_date) >= :date_from"
        params["date_from"] = date_from

    if date_to:
        sql += " AND DATE(po.due_date) <= :date_to"
        params["date_to"] = date_to

    if search:
        sql += """
          AND (
            LOWER(COALESCE(po.order_number, '')) LIKE :search
            OR LOWER(COALESCE(po.target_dress_name, '')) LIKE :search
            OR LOWER(COALESCE(po.target_dress_code, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    sql += """
        GROUP BY
            po.id,
            po.order_number,
            po.target_dress_name,
            po.target_dress_code,
            s.name,
            po.status,
            po.priority,
            po.due_date,
            po.planned_quantity,
            po.produced_quantity,
            po.labor_cost,
            po.additional_cost,
            po.currency
        ORDER BY po.due_date DESC NULLS LAST, po.order_number DESC
    """

    return text(sql), params


@router.get("/production-costs")
def production_costs_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_production_costs_query(
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    items = []

    for row in rows:
        estimated_material = Decimal(str(row["estimated_material_cost"] or 0))
        actual_material = Decimal(str(row["actual_material_cost"] or 0))
        labor = Decimal(str(row["labor_cost"] or 0))
        additional = Decimal(str(row["additional_cost"] or 0))

        total_estimated = estimated_material + labor + additional
        total_actual = actual_material + labor + additional

        planned = Decimal(str(row["planned_quantity"] or 0))
        produced = Decimal(str(row["produced_quantity"] or 0))

        unit_estimated = float(total_estimated / planned) if planned > 0 else None
        unit_actual = float(total_actual / produced) if produced > 0 else None

        items.append(
            {
                "id": str(row["id"]),
                "order_number": row["order_number"],
                "dress": row["target_dress_name"],
                "workshop": row["workshop_supplier_name"],
                "status": row["status"],
                "priority": row["priority"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "planned_quantity": float(planned),
                "produced_quantity": float(produced),
                "estimated_material_cost": float(estimated_material),
                "actual_material_cost": float(actual_material),
                "labor_cost": float(labor),
                "additional_cost": float(additional),
                "total_estimated": float(total_estimated),
                "total_actual": float(total_actual),
                "unit_estimated": unit_estimated,
                "unit_actual": unit_actual,
                "currency": "ARS",
            }
        )

    return {
        "items": items,
        "total": len(items),
    }


@router.get("/production-costs/export")
def export_production_costs_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_production_costs_query(
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Costos producción"

    headers = [
        "Orden",
        "Vestido",
        "Taller",
        "Estado",
        "Prioridad",
        "Entrega",
        "Planificado",
        "Producido",
        "Materiales est.",
        "Materiales real",
        "Mano de obra",
        "Adicional",
        "Total est.",
        "Total real",
        "Unitario est.",
        "Unitario real",
        "Moneda",
    ]
    _apply_header_style(ws, headers)

    for row in rows:
        estimated_material = Decimal(str(row["estimated_material_cost"] or 0))
        actual_material = Decimal(str(row["actual_material_cost"] or 0))
        labor = Decimal(str(row["labor_cost"] or 0))
        additional = Decimal(str(row["additional_cost"] or 0))

        total_estimated = estimated_material + labor + additional
        total_actual = actual_material + labor + additional

        planned = Decimal(str(row["planned_quantity"] or 0))
        produced = Decimal(str(row["produced_quantity"] or 0))

        unit_estimated = float(total_estimated / planned) if planned > 0 else None
        unit_actual = float(total_actual / produced) if produced > 0 else None

        ws.append(
            [
                row["order_number"],
                row["target_dress_name"],
                row["workshop_supplier_name"],
                row["status"],
                row["priority"],
                row["due_date"].strftime("%Y-%m-%d") if row["due_date"] else "",
                float(planned),
                float(produced),
                float(estimated_material),
                float(actual_material),
                float(labor),
                float(additional),
                float(total_estimated),
                float(total_actual),
                unit_estimated,
                unit_actual,
                "ARS",
            ]
        )

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=7, max_col=16):
        for cell in row:
            if isinstance(cell.value, (int, float)):
                cell.number_format = "#,##0.00"

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 24
    ws.column_dimensions["C"].width = 24
    ws.column_dimensions["D"].width = 18
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 14
    ws.column_dimensions["G"].width = 14
    ws.column_dimensions["H"].width = 14
    ws.column_dimensions["I"].width = 16
    ws.column_dimensions["J"].width = 16
    ws.column_dimensions["K"].width = 16
    ws.column_dimensions["L"].width = 14
    ws.column_dimensions["M"].width = 16
    ws.column_dimensions["N"].width = 16
    ws.column_dimensions["O"].width = 16
    ws.column_dimensions["P"].width = 16
    ws.column_dimensions["Q"].width = 12

    return _excel_response(wb, "costos_produccion.xlsx")


# =========================================================
# VENTAS DE VESTIDOS
# =========================================================

@router.get("/sales")
def sales_report(
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = (
        select(DressSale, Dress, Customer)
        .join(Dress, Dress.id == DressSale.dress_id)
        .outerjoin(Customer, Customer.id == DressSale.customer_id)
        .where(DressSale.tenant_id == tenant_id)
    )

    if status_filter:
        stmt = stmt.where(DressSale.status == status_filter)
    if payment_method:
        stmt = stmt.where(DressSale.payment_method == payment_method)
    if date_from:
        stmt = stmt.where(DressSale.sale_date >= date_from)
    if date_to:
        stmt = stmt.where(DressSale.sale_date <= date_to)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Dress.code.ilike(pattern),
                Dress.name.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
            )
        )

    rows = db.execute(stmt.order_by(desc(DressSale.sale_date))).all()

    items = []
    total_amount = 0

    for sale, dress, customer in rows:
        total_amount += float(sale.sale_price or 0)
        items.append({
            "id": str(sale.id),
            "sale_number": getattr(sale, "sale_number", None),
            "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
            "dress_code": getattr(dress, "code", None),
            "dress_name": getattr(dress, "name", None),
            "customer_full_name": getattr(customer, "full_name", None) or (
                f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip() if customer else ""
            ),
            "sale_price": float(sale.sale_price or 0),
            "currency": sale.currency,
            "payment_method": _payment_method_label(sale.payment_method),
            "status": sale.status,
            "notes": sale.notes,
        })

    return {
        "items": items,
        "total": len(items),
        "total_amount": total_amount,
    }

@router.get("/sales/export")
def export_sales_report(
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = (
        select(DressSale, Dress, Customer)
        .join(Dress, Dress.id == DressSale.dress_id)
        .outerjoin(Customer, Customer.id == DressSale.customer_id)
        .where(DressSale.tenant_id == tenant_id)
    )

    if status_filter:
        stmt = stmt.where(DressSale.status == status_filter)
    if payment_method:
        stmt = stmt.where(DressSale.payment_method == payment_method)
    if date_from:
        stmt = stmt.where(DressSale.sale_date >= date_from)
    if date_to:
        stmt = stmt.where(DressSale.sale_date <= date_to)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Dress.code.ilike(pattern),
                Dress.name.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
            )
        )

    rows = db.execute(stmt.order_by(desc(DressSale.sale_date))).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas"

    headers = [
        "N° Venta",
        "Fecha",
        "Código vestido",
        "Vestido",
        "Cliente",
        "Precio",
        "Moneda",
        "Método de pago",
        "Estado",
        "Notas",
    ]
    _apply_header_style(ws, headers)

    total_amount = Decimal("0")

    for sale, dress, customer in rows:
        sale_price = Decimal(str(sale.sale_price or 0))
        total_amount += sale_price

        customer_name = getattr(customer, "full_name", None) or (
            f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
            if customer else ""
        )

        ws.append(
            [
                getattr(sale, "sale_number", "") or "",
                sale.sale_date.strftime("%Y-%m-%d %H:%M") if sale.sale_date else "",
                getattr(dress, "code", "") or "",
                getattr(dress, "name", "") or "",
                customer_name,
                float(sale_price),
                sale.currency or "USD",
                _payment_method_label(sale.payment_method),
                _sale_status_label(sale.status),
                sale.notes or "",
            ]
        )

        current_row = ws.max_row

        price_cell = ws.cell(row=current_row, column=5)
        price_cell.number_format = "#,##0.00"
        price_cell.alignment = Alignment(horizontal="right", vertical="center")

        currency_cell = ws.cell(row=current_row, column=6)
        currency_cell.alignment = Alignment(horizontal="center", vertical="center")

        payment_cell = ws.cell(row=current_row, column=7)
        payment_cell.alignment = Alignment(horizontal="center", vertical="center")

        status_cell = ws.cell(row=current_row, column=8)
        status_cell.fill = _sale_status_fill(sale.status)
        status_cell.font = _sale_status_font(sale.status)
        status_cell.alignment = Alignment(horizontal="center", vertical="center")

        notes_cell = ws.cell(row=current_row, column=9)
        notes_cell.alignment = Alignment(wrap_text=True, vertical="top")

    total_row_idx = ws.max_row + 2
    ws.cell(row=total_row_idx, column=7, value="TOTAL")
    ws.cell(row=total_row_idx, column=7).font = Font(bold=True)
    ws.cell(row=total_row_idx, column=7).alignment = Alignment(horizontal="right", vertical="center")

    total_value_cell = ws.cell(row=total_row_idx, column=8, value=float(total_amount))
    total_value_cell.font = Font(bold=True)
    total_value_cell.number_format = "#,##0.00"
    total_value_cell.alignment = Alignment(horizontal="right", vertical="center")

    total_label_fill = PatternFill("solid", fgColor="F4F1F5")
    ws.cell(row=total_row_idx, column=7).fill = total_label_fill
    ws.cell(row=total_row_idx, column=8).fill = total_label_fill

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:I{ws.max_row}"

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 18
    ws.column_dimensions["D"].width = 28
    ws.column_dimensions["E"].width = 28
    ws.column_dimensions["F"].width = 14
    ws.column_dimensions["G"].width = 12
    ws.column_dimensions["H"].width = 22
    ws.column_dimensions["I"].width = 14
    ws.column_dimensions["J"].width = 40
    
    return _excel_response(wb, "ventas.xlsx")

# =========================================================
# VENTAS DE ACCESORIOS
# =========================================================

@router.get("/accessory-sales")
def accessory_sales_report(
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = (
        select(AccessorySale, Accessory, Customer)
        .join(Accessory, Accessory.id == AccessorySale.accessory_id)
        .outerjoin(Customer, Customer.id == AccessorySale.customer_id)
        .where(AccessorySale.tenant_id == tenant_id)
    )

    if status_filter:
        stmt = stmt.where(AccessorySale.status == status_filter)

    if payment_method:
        stmt = stmt.where(AccessorySale.payment_method == payment_method)

    if date_from:
        stmt = stmt.where(AccessorySale.sale_date >= date_from)

    if date_to:
        stmt = stmt.where(AccessorySale.sale_date <= date_to)

    if q:
        pattern = f"%{q.strip()}%"
        search_clauses = [
            Accessory.code.ilike(pattern),
            Accessory.name.ilike(pattern),
            Customer.first_name.ilike(pattern),
            Customer.last_name.ilike(pattern),
        ]

        if hasattr(AccessorySale, "sale_number"):
            search_clauses.append(AccessorySale.sale_number.ilike(pattern))

        stmt = stmt.where(or_(*search_clauses))

    rows = db.execute(stmt.order_by(desc(AccessorySale.sale_date))).all()

    items = []
    total_amount = Decimal("0")

    for sale, accessory, customer in rows:
        total_amount += Decimal(str(sale.total_price or 0))

        items.append(
            {
                "id": str(sale.id),
                "sale_number": getattr(sale, "sale_number", None),
                "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
                "accessory_code": getattr(accessory, "code", None),
                "accessory_name": getattr(accessory, "name", None),
                "customer_full_name": getattr(customer, "full_name", None) or (
                    f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
                    if customer else ""
                ),
                "quantity": int(sale.quantity or 0),
                "unit_price": float(sale.unit_price or 0),
                "total_price": float(sale.total_price or 0),
                "currency": sale.currency or "ARS",
                "payment_method": _payment_method_label(sale.payment_method),
                "status": sale.status,
                "notes": sale.notes,
            }
        )

    return {
        "items": items,
        "total": len(items),
        "total_amount": float(total_amount),
    }

@router.get("/accessory-sales/export")
def export_accessory_sales_report(
    q: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = (
        select(AccessorySale, Accessory, Customer)
        .join(Accessory, Accessory.id == AccessorySale.accessory_id)
        .outerjoin(Customer, Customer.id == AccessorySale.customer_id)
        .where(AccessorySale.tenant_id == tenant_id)
    )

    if status_filter:
        stmt = stmt.where(AccessorySale.status == status_filter)

    if payment_method:
        stmt = stmt.where(AccessorySale.payment_method == payment_method)

    if date_from:
        stmt = stmt.where(AccessorySale.sale_date >= date_from)

    if date_to:
        stmt = stmt.where(AccessorySale.sale_date <= date_to)

    if q:
        pattern = f"%{q.strip()}%"
        search_clauses = [
            Accessory.code.ilike(pattern),
            Accessory.name.ilike(pattern),
            Customer.first_name.ilike(pattern),
            Customer.last_name.ilike(pattern),
        ]

        if hasattr(AccessorySale, "sale_number"):
            search_clauses.append(AccessorySale.sale_number.ilike(pattern))

        stmt = stmt.where(or_(*search_clauses))

    rows = db.execute(stmt.order_by(desc(AccessorySale.sale_date))).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas accesorios"

    headers = [
        "N° Venta",
        "Fecha",
        "Código accesorio",
        "Accesorio",
        "Cliente",
        "Cantidad",
        "Precio unitario",
        "Total",
        "Moneda",
        "Método de pago",
        "Estado",
        "Notas",
    ]
    _apply_header_style(ws, headers)

    total_amount = Decimal("0")

    for sale, accessory, customer in rows:
        total_price = Decimal(str(sale.total_price or 0))
        total_amount += total_price

        customer_name = getattr(customer, "full_name", None) or (
            f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
            if customer else ""
        )

        ws.append(
            [
                getattr(sale, "sale_number", "") or "",
                sale.sale_date.strftime("%Y-%m-%d %H:%M") if sale.sale_date else "",
                getattr(accessory, "code", "") or "",
                getattr(accessory, "name", "") or "",
                customer_name,
                int(sale.quantity or 0),
                float(sale.unit_price or 0),
                float(total_price),
                sale.currency or "ARS",
                _payment_method_label(sale.payment_method),
                _sale_status_label(sale.status),
                sale.notes or "",
            ]
        )

        current_row = ws.max_row

        qty_cell = ws.cell(row=current_row, column=6)
        qty_cell.alignment = Alignment(horizontal="center", vertical="center")

        unit_price_cell = ws.cell(row=current_row, column=7)
        unit_price_cell.number_format = "#,##0.00"
        unit_price_cell.alignment = Alignment(horizontal="right", vertical="center")

        total_cell = ws.cell(row=current_row, column=8)
        total_cell.number_format = "#,##0.00"
        total_cell.alignment = Alignment(horizontal="right", vertical="center")

        currency_cell = ws.cell(row=current_row, column=9)
        currency_cell.alignment = Alignment(horizontal="center", vertical="center")

        payment_cell = ws.cell(row=current_row, column=10)
        payment_cell.alignment = Alignment(horizontal="center", vertical="center")

        status_cell = ws.cell(row=current_row, column=11)
        status_cell.fill = _sale_status_fill(sale.status)
        status_cell.font = _sale_status_font(sale.status)
        status_cell.alignment = Alignment(horizontal="center", vertical="center")

        notes_cell = ws.cell(row=current_row, column=12)
        notes_cell.alignment = Alignment(wrap_text=True, vertical="top")

    total_row_idx = ws.max_row + 2

    ws.cell(row=total_row_idx, column=10, value="TOTAL")
    ws.cell(row=total_row_idx, column=10).font = Font(bold=True)
    ws.cell(row=total_row_idx, column=10).alignment = Alignment(horizontal="right", vertical="center")

    total_value_cell = ws.cell(row=total_row_idx, column=11, value=float(total_amount))
    total_value_cell.font = Font(bold=True)
    total_value_cell.number_format = "#,##0.00"
    total_value_cell.alignment = Alignment(horizontal="right", vertical="center")

    total_label_fill = PatternFill("solid", fgColor="F4F1F5")
    ws.cell(row=total_row_idx, column=10).fill = total_label_fill
    ws.cell(row=total_row_idx, column=11).fill = total_label_fill

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:L{ws.max_row}"

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 18
    ws.column_dimensions["D"].width = 28
    ws.column_dimensions["E"].width = 28
    ws.column_dimensions["F"].width = 12
    ws.column_dimensions["G"].width = 16
    ws.column_dimensions["H"].width = 16
    ws.column_dimensions["I"].width = 12
    ws.column_dimensions["J"].width = 22
    ws.column_dimensions["K"].width = 14
    ws.column_dimensions["L"].width = 40

    return _excel_response(wb, "ventas_accesorios.xlsx")



# =========================================================
# VENTAS UNIFICADAS
# =========================================================

def _build_sales_unified_query(
    search: str | None = None,
    status: str | None = None,
    currency: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    sql = """
        SELECT
            s.id,
            s.sale_number,
            s.sale_date,
            s.customer_id,
            s.currency,
            s.status,
            s.subtotal_amount,
            s.discount_amount,
            s.total_amount,
            s.notes,
            TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS customer_full_name
        FROM sales s
        LEFT JOIN customers c
            ON c.id = s.customer_id
        WHERE s.tenant_id = :tenant_id
    """

    params: dict[str, object] = {}

    if status:
        sql += " AND s.status = :status"
        params["status"] = status.strip().upper()

    if currency:
        sql += " AND s.currency = :currency"
        params["currency"] = currency.strip().upper()

    if date_from:
        sql += " AND DATE(s.sale_date) >= :date_from"
        params["date_from"] = date_from

    if date_to:
        sql += " AND DATE(s.sale_date) <= :date_to"
        params["date_to"] = date_to

    if search:
        sql += """
          AND (
            LOWER(COALESCE(s.sale_number, '')) LIKE :search
            OR LOWER(COALESCE(c.full_name, '')) LIKE :search
            OR LOWER(COALESCE(c.first_name, '')) LIKE :search
            OR LOWER(COALESCE(c.last_name, '')) LIKE :search
            OR LOWER(COALESCE(s.notes, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    sql += """
        ORDER BY s.sale_date DESC, s.created_at DESC
    """

    return text(sql), params


def _get_sales_unified_items(db: Session, tenant_id, sale_id):
    sql = text("""
        SELECT
            si.id,
            si.item_type,
            si.description_snapshot,
            si.quantity,
            si.unit_price,
            si.currency,
            si.line_total
        FROM sale_items si
        WHERE si.tenant_id = :tenant_id
          AND si.sale_id = :sale_id
        ORDER BY si.created_at ASC, si.id ASC
    """)
    return db.execute(sql, {"tenant_id": tenant_id, "sale_id": sale_id}).mappings().all()


def _get_sales_unified_payments(db: Session, tenant_id, sale_id):
    sql = text("""
        SELECT
            sp.id,
            sp.payment_method,
            sp.amount,
            sp.currency,
            sp.reference,
            sp.notes
        FROM sale_payments sp
        WHERE sp.tenant_id = :tenant_id
          AND sp.sale_id = :sale_id
        ORDER BY sp.created_at ASC, sp.id ASC
    """)
    return db.execute(sql, {"tenant_id": tenant_id, "sale_id": sale_id}).mappings().all()

@router.get("/dress-stock-valuation")
def dress_stock_valuation_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
):
    sql = """
        SELECT
            d.id,
            d.code,
            d.name,
            d.size,
            d.color,
            d.status,
            d.sale_price,
            d.rental_price,
            c.name AS capsule_name
        FROM dresses d
        LEFT JOIN capsules c ON c.id = d.capsule_id
        WHERE d.tenant_id = :tenant_id
          AND d.deleted_at IS NULL
    """

    params = {"tenant_id": membership.tenant_id}

    if search:
        sql += """
          AND (
            LOWER(d.code) LIKE :search
            OR LOWER(d.name) LIKE :search
            OR LOWER(COALESCE(d.color,'')) LIKE :search
          )
        """
        params["search"] = f"%{search.lower()}%"

    rows = db.execute(text(sql), params).mappings().all()

    items = []
    total_sale = Decimal("0")
    total_rental = Decimal("0")
    total_items = 0
    available_items = 0

    for r in rows:
        if r["status"] != "SOLD":
            total_items += 1

            sale_price = Decimal(str(r["sale_price"] or 0))
            rental_price = Decimal(str(r["rental_price"] or 0))

            total_sale += sale_price
            total_rental += rental_price

            if r["status"] == "AVAILABLE":
                available_items += 1

            items.append({
                "id": str(r["id"]),
                "code": r["code"],
                "name": r["name"],
                "capsule": r["capsule_name"],
                "size": r["size"],
                "color": r["color"],
                "status": r["status"],
                "sale_price": float(sale_price),
                "rental_price": float(rental_price),
            })

    return {
        "items": items,
        "total": len(items),
        "kpis": {
            "total_items": total_items,
            "available_items": available_items,
            "total_sale_value": float(total_sale),
            "total_rental_value": float(total_rental),
        }
    }

def _dress_status_label(value: str | None) -> str:
    raw = (value or "").upper()
    if raw == "AVAILABLE":
        return "Disponible"
    if raw == "LOANED":
        return "Prestado"
    if raw == "RENTED":
        return "Alquilado"
    if raw == "CLEANING":
        return "Limpieza"
    if raw == "MAINTENANCE":
        return "Reparación"
    if raw == "SOLD":
        return "Vendido"
    if raw == "RETIRED":
        return "Retirado"
    return value or ""


@router.get("/dress-stock-valuation/export")
def export_dress_stock_valuation_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    search: str | None = Query(default=None),
):
    sql = """
        SELECT
            d.code,
            d.name,
            c.name AS capsule,
            d.size,
            d.color,
            d.status,
            COALESCE(d.sale_price, 0) AS sale_price,
            COALESCE(d.rental_price, 0) AS rental_price
        FROM dresses d
        LEFT JOIN capsules c
            ON c.id = d.capsule_id
        WHERE d.tenant_id = :tenant_id
          AND d.deleted_at IS NULL
          AND d.status != 'SOLD'
    """

    params: dict[str, object] = {
        "tenant_id": membership.tenant_id,
    }

    if search:
        sql += """
          AND (
            LOWER(COALESCE(d.code, '')) LIKE :search
            OR LOWER(COALESCE(d.name, '')) LIKE :search
            OR LOWER(COALESCE(c.name, '')) LIKE :search
            OR LOWER(COALESCE(d.size, '')) LIKE :search
            OR LOWER(COALESCE(d.color, '')) LIKE :search
          )
        """
        params["search"] = f"%{search.strip().lower()}%"

    sql += """
        ORDER BY d.name ASC, d.code ASC
    """

    rows = db.execute(text(sql), params).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Stock vestidos"

    headers = [
        "Código",
        "Vestido",
        "Cápsula",
        "Talle",
        "Color",
        "Estado",
        "Precio venta (USD)",
        "Precio alquiler (USD)",
    ]
    _apply_header_style(ws, headers)

    total_sale = Decimal("0")
    total_rental = Decimal("0")

    for row in rows:
        sale_price = Decimal(str(row["sale_price"] or 0))
        rental_price = Decimal(str(row["rental_price"] or 0))

        total_sale += sale_price
        total_rental += rental_price

        ws.append(
            [
                row["code"],
                row["name"],
                row["capsule"],
                row["size"],
                row["color"],
                _dress_status_label(row["status"]),
                float(sale_price),
                float(rental_price),
            ]
        )

    total_row_idx = ws.max_row + 2

    ws.cell(row=total_row_idx, column=6, value="TOTAL")
    ws.cell(row=total_row_idx, column=6).font = Font(bold=True)
    ws.cell(row=total_row_idx, column=6).alignment = Alignment(
        horizontal="right",
        vertical="center",
    )

    ws.cell(row=total_row_idx, column=7, value=float(total_sale))
    ws.cell(row=total_row_idx, column=7).font = Font(bold=True)

    ws.cell(row=total_row_idx, column=8, value=float(total_rental))
    ws.cell(row=total_row_idx, column=8).font = Font(bold=True)

    for row_cells in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=7, max_col=8):
        for cell in row_cells:
            if isinstance(cell.value, (int, float)):
                cell.number_format = '#,##0.00 "USD"'
                cell.alignment = Alignment(horizontal="right", vertical="center")

    for row_cells in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=6, max_col=6):
        for cell in row_cells:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 24
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 18
    ws.column_dimensions["F"].width = 16
    ws.column_dimensions["G"].width = 20
    ws.column_dimensions["H"].width = 22

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:H{ws.max_row}"

    return _excel_response(wb, "stock_valorizado_vestidos.xlsx")

@router.get("/sales-unified")
def sales_unified_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    currency: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql = """
        SELECT
            s.id,
            s.sale_number,
            s.sale_date,
            s.customer_id,
            s.currency,
            s.status,
            s.subtotal_amount,
            s.discount_amount,
            s.total_amount,
            s.notes,
            TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS customer_full_name
        FROM sales s
        LEFT JOIN customers c
            ON c.id = s.customer_id
        WHERE s.tenant_id = :tenant_id
    """

    params: dict[str, object] = {"tenant_id": membership.tenant_id}

    if q:
        sql += """
          AND (
            LOWER(COALESCE(s.sale_number, '')) LIKE :q
            OR LOWER(COALESCE(s.notes, '')) LIKE :q
            OR LOWER(COALESCE(c.first_name, '')) LIKE :q
            OR LOWER(COALESCE(c.last_name, '')) LIKE :q
          )
        """
        params["q"] = f"%{q.strip().lower()}%"

    if status:
        sql += " AND s.status = :status"
        params["status"] = status.strip().upper()

    if currency:
        sql += " AND s.currency = :currency"
        params["currency"] = currency.strip().upper()

    if date_from:
        sql += " AND DATE(s.sale_date) >= :date_from"
        params["date_from"] = date_from

    if date_to:
        sql += " AND DATE(s.sale_date) <= :date_to"
        params["date_to"] = date_to

    sql += """
        ORDER BY s.sale_date DESC, s.created_at DESC
    """

    sales_rows = db.execute(text(sql), params).mappings().all()

    items = []
    total_ars = Decimal("0")
    total_usd = Decimal("0")
    mixed_count = 0

    for row in sales_rows:
        sale_id = row["id"]

        sale_items = db.execute(
            text("""
                SELECT
                    si.id,
                    si.item_type,
                    si.description_snapshot,
                    si.quantity,
                    si.unit_price,
                    COALESCE(si.currency, 'ARS') AS currency,
                    si.line_total
                FROM sale_items si
                WHERE si.sale_id = :sale_id
                  AND si.tenant_id = :tenant_id
                ORDER BY si.id
            """),
            {"sale_id": sale_id, "tenant_id": membership.tenant_id},
        ).mappings().all()

        sale_payments = db.execute(
            text("""
                SELECT
                    sp.id,
                    sp.payment_method,
                    sp.amount,
                    COALESCE(sp.currency, 'ARS') AS currency,
                    sp.reference,
                    sp.notes
                FROM sale_payments sp
                WHERE sp.sale_id = :sale_id
                  AND sp.tenant_id = :tenant_id
                ORDER BY sp.id
            """),
            {"sale_id": sale_id, "tenant_id": membership.tenant_id},
        ).mappings().all()

        items_total_ars = sum(
            float(item["line_total"] or 0)
            for item in sale_items
            if str(item["currency"] or "ARS").upper() == "ARS"
        )
        items_total_usd = sum(
            float(item["line_total"] or 0)
            for item in sale_items
            if str(item["currency"] or "ARS").upper() == "USD"
        )
        paid_total_ars = sum(
            float(payment["amount"] or 0)
            for payment in sale_payments
            if str(payment["currency"] or "ARS").upper() == "ARS"
        )
        paid_total_usd = sum(
            float(payment["amount"] or 0)
            for payment in sale_payments
            if str(payment["currency"] or "ARS").upper() == "USD"
        )

        if items_total_ars > 0:
            total_ars += Decimal(str(items_total_ars))
        if items_total_usd > 0:
            total_usd += Decimal(str(items_total_usd))
        if items_total_ars > 0 and items_total_usd > 0:
            mixed_count += 1

        items.append(
            {
                "id": str(row["id"]),
                "sale_number": row["sale_number"],
                "sale_date": row["sale_date"].isoformat() if row["sale_date"] else None,
                "customer_full_name": row["customer_full_name"] or None,
                "currency": row["currency"],
                "status": row["status"],
                "subtotal_amount": float(row["subtotal_amount"] or 0),
                "discount_amount": float(row["discount_amount"] or 0),
                "total_amount": float(row["total_amount"] or 0),
                "notes": row["notes"],
                "items_total_ars": float(items_total_ars),
                "items_total_usd": float(items_total_usd),
                "paid_total_ars": float(paid_total_ars),
                "paid_total_usd": float(paid_total_usd),
                "items": [
                    {
                        "id": str(item["id"]),
                        "item_type": item["item_type"],
                        "description_snapshot": item["description_snapshot"],
                        "quantity": int(item["quantity"] or 0),
                        "unit_price": float(item["unit_price"] or 0),
                        "currency": item["currency"] or "ARS",
                        "line_total": float(item["line_total"] or 0),
                    }
                    for item in sale_items
                ],
                "payments": [
                    {
                        "id": str(payment["id"]),
                        "payment_method": payment["payment_method"],
                        "amount": float(payment["amount"] or 0),
                        "currency": payment["currency"] or "ARS",
                        "reference": payment["reference"],
                        "notes": payment["notes"],
                    }
                    for payment in sale_payments
                ],
            }
        )

    return {
        "items": items,
        "total": len(items),
        "total_ars": float(total_ars),
        "total_usd": float(total_usd),
        "mixed_count": mixed_count,
    }

@router.get("/sales-unified/export")
def export_sales_unified_report(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    currency: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    sql, extra_params = _build_sales_unified_query(
        search=q,
        status=status,
        currency=currency,
        date_from=date_from,
        date_to=date_to,
    )

    rows = db.execute(
        sql,
        {"tenant_id": membership.tenant_id, **extra_params},
    ).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas unificadas"

    headers = [
        "N° Venta",
        "Fecha",
        "Cliente",
        "Moneda cabecera",
        "Estado",
        "Total ítems ARS",
        "Total ítems USD",
        "Pagado ARS",
        "Pagado USD",
        "Ítems",
        "Pagos",
        "Notas",
    ]
    _apply_header_style(ws, headers)

    total_items_ars = Decimal("0")
    total_items_usd = Decimal("0")
    total_paid_ars = Decimal("0")
    total_paid_usd = Decimal("0")

    for row in rows:
        sale_id = row["id"]

        item_rows = db.execute(
            text("""
                SELECT
                    id,
                    item_type,
                    description_snapshot,
                    quantity,
                    unit_price,
                    currency,
                    line_total
                FROM sale_items
                WHERE sale_id = :sale_id
                ORDER BY created_at ASC, id ASC
            """),
            {"sale_id": sale_id},
        ).mappings().all()

        payment_rows = db.execute(
            text("""
                SELECT
                    id,
                    payment_method,
                    amount,
                    currency,
                    reference,
                    notes
                FROM sale_payments
                WHERE sale_id = :sale_id
                ORDER BY created_at ASC, id ASC
            """),
            {"sale_id": sale_id},
        ).mappings().all()

        items_total_ars = Decimal("0")
        items_total_usd = Decimal("0")
        paid_total_ars = Decimal("0")
        paid_total_usd = Decimal("0")

        item_parts: list[str] = []
        for item in item_rows:
            line_total = Decimal(str(item["line_total"] or 0))
            currency_value = (item["currency"] or "ARS").upper()

            if currency_value == "USD":
                items_total_usd += line_total
            else:
                items_total_ars += line_total

            item_type_label = "Vestido" if str(item["item_type"] or "").upper() == "DRESS" else "Accesorio"
            item_parts.append(
                f"{item_type_label}: {item['description_snapshot'] or 'Ítem'} · "
                f"x{int(item['quantity'] or 0)} · {currency_value} {float(line_total):,.2f}"
            )

        payment_parts: list[str] = []
        for payment in payment_rows:
            amount = Decimal(str(payment["amount"] or 0))
            currency_value = (payment["currency"] or "ARS").upper()

            if currency_value == "USD":
                paid_total_usd += amount
            else:
                paid_total_ars += amount

            reference_text = f" · {payment['reference']}" if payment["reference"] else ""
            payment_parts.append(
                f"{_payment_method_label(payment['payment_method'])}: "
                f"{currency_value} {float(amount):,.2f}{reference_text}"
            )

        total_items_ars += items_total_ars
        total_items_usd += items_total_usd
        total_paid_ars += paid_total_ars
        total_paid_usd += paid_total_usd

        ws.append(
            [
                row["sale_number"] or "",
                row["sale_date"].strftime("%Y-%m-%d %H:%M") if row["sale_date"] else "",
                row["customer_full_name"] or "",
                row["currency"] or "ARS",
                _sale_status_label(row["status"]),
                float(items_total_ars),
                float(items_total_usd),
                float(paid_total_ars),
                float(paid_total_usd),
                " | ".join(item_parts),
                " | ".join(payment_parts),
                row["notes"] or "",
            ]
        )

        current_row = ws.max_row

        for col in (6, 7, 8, 9):
            cell = ws.cell(row=current_row, column=col)
            cell.number_format = "#,##0.00"
            cell.alignment = Alignment(horizontal="right", vertical="center")

        status_cell = ws.cell(row=current_row, column=5)
        status_cell.fill = _sale_status_fill(row["status"])
        status_cell.font = _sale_status_font(row["status"])
        status_cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.cell(row=current_row, column=10).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=current_row, column=11).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=current_row, column=12).alignment = Alignment(wrap_text=True, vertical="top")

    total_row_idx = ws.max_row + 2

    ws.cell(row=total_row_idx, column=5, value="TOTALES")
    ws.cell(row=total_row_idx, column=5).font = Font(bold=True)
    ws.cell(row=total_row_idx, column=5).alignment = Alignment(horizontal="right", vertical="center")

    ws.cell(row=total_row_idx, column=6, value=float(total_items_ars))
    ws.cell(row=total_row_idx, column=7, value=float(total_items_usd))
    ws.cell(row=total_row_idx, column=8, value=float(total_paid_ars))
    ws.cell(row=total_row_idx, column=9, value=float(total_paid_usd))

    for col in (6, 7, 8, 9):
        cell = ws.cell(row=total_row_idx, column=col)
        cell.font = Font(bold=True)
        cell.number_format = "#,##0.00"
        cell.alignment = Alignment(horizontal="right", vertical="center")

    total_fill = PatternFill("solid", fgColor="F4F1F5")
    for col in range(5, 10):
        ws.cell(row=total_row_idx, column=col).fill = total_fill

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:L{ws.max_row}"

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 28
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 16
    ws.column_dimensions["G"].width = 16
    ws.column_dimensions["H"].width = 16
    ws.column_dimensions["I"].width = 16
    ws.column_dimensions["J"].width = 52
    ws.column_dimensions["K"].width = 42
    ws.column_dimensions["L"].width = 30

    return _excel_response(wb, "ventas_unificadas.xlsx")
