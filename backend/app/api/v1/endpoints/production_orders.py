from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from uuid import UUID as UUIDType

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, File, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.dress import Dress
from app.models.fabric_movement import FabricMovement
from app.models.fabric_roll import FabricRoll
from app.models.production_order import ProductionOrder
from app.models.production_order_event import ProductionOrderEvent
from app.models.production_order_material import ProductionOrderMaterial
from app.models.production_order_output import ProductionOrderOutput
from app.models.supplier import Supplier
from app.models.trim import Trim
from app.models.trim_movement import TrimMovement
from app.schemas.production_order import (
    ProductionOrderCostSummary,
    ProductionOrderCostsUpdate,
    ProductionOrderCreate,
    ProductionOrderEventResponse,
    ProductionOrderMaterialAdd,
    ProductionOrderMaterialResponse,
    ProductionOrderMaterialReturn,
    ProductionOrderReceive,
    ProductionOrderResponse,
)
from app.schemas.production_output import (
    ProductionOrderOutputCreate,
    ProductionOrderOutputResponse,
)
from app.services.sequences import get_next_code

from app.models.tenant import Tenant
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/production-orders", tags=["production-orders"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _fmt_decimal(value) -> str:
    if value is None:
        return "-"
    d = Decimal(str(value))
    return f"{d:.2f}"


def _fmt_datetime(value) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    return str(value)


def _fmt_date(value) -> str:
    if not value:
        return "-"
    try:
        return value.strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _get_order_or_404(db: Session, tenant_id, order_id: UUIDType) -> ProductionOrder:
    order = db.execute(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id,
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not order:
        raise AppException(404, "Production order not found", "PRODUCTION_ORDER_NOT_FOUND")

    return order


def create_order_event(
    db: Session,
    tenant_id,
    production_order_id,
    created_by_user_id,
    event_type: str,
    payload: dict | None = None,
):
    event = ProductionOrderEvent(
        tenant_id=tenant_id,
        production_order_id=production_order_id,
        created_by_user_id=created_by_user_id,
        event_type=event_type,
        payload=payload,
        created_at=_now_utc(),
    )
    db.add(event)


def calculate_order_costs(db: Session, order: ProductionOrder) -> dict:
    materials = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.production_order_id == order.id,
            ProductionOrderMaterial.tenant_id == order.tenant_id,
        )
    ).scalars().all()

    estimated_material_cost = Decimal("0")
    actual_material_cost = Decimal("0")

    for material in materials:
        unit_cost = _decimal(material.unit_cost_snapshot)
        planned_quantity = _decimal(material.planned_quantity)
        consumed_quantity = _decimal(material.consumed_quantity)

        estimated_material_cost += planned_quantity * unit_cost
        actual_material_cost += consumed_quantity * unit_cost

    labor_cost = _decimal(order.labor_cost)
    additional_cost = _decimal(order.additional_cost)

    estimated_total_cost = estimated_material_cost + labor_cost + additional_cost
    actual_total_cost = actual_material_cost + labor_cost + additional_cost

    planned_qty = max(int(order.planned_quantity or 0), 1)
    produced_qty = max(int(order.produced_quantity or 0), 1)

    estimated_unit_cost = estimated_total_cost / Decimal(str(planned_qty))
    actual_unit_cost = actual_total_cost / Decimal(str(produced_qty))

    return {
        "estimated_material_cost": estimated_material_cost,
        "actual_material_cost": actual_material_cost,
        "labor_cost": labor_cost,
        "additional_cost": additional_cost,
        "estimated_total_cost": estimated_total_cost,
        "actual_total_cost": actual_total_cost,
        "estimated_unit_cost": estimated_unit_cost,
        "actual_unit_cost": actual_unit_cost,
        "currency": order.currency or "USD",
    }


def sync_order_totals(db: Session, order: ProductionOrder) -> None:
    totals = calculate_order_costs(db, order)
    order.estimated_total_cost = totals["estimated_total_cost"]
    order.actual_total_cost = totals["actual_total_cost"]


def build_order_response(db: Session, order: ProductionOrder) -> ProductionOrderResponse:
    workshop = None
    if order.workshop_supplier_id:
        workshop = db.execute(
            select(Supplier).where(
                Supplier.id == order.workshop_supplier_id,
                Supplier.tenant_id == order.tenant_id,
            )
        ).scalar_one_or_none()

    return ProductionOrderResponse(
        id=order.id,
        tenant_id=order.tenant_id,
        order_number=order.order_number,
        workshop_supplier_id=order.workshop_supplier_id,
        workshop_supplier_name=workshop.name if workshop else None,
        target_dress_name=order.target_dress_name,
        target_dress_code=order.target_dress_code,
        target_size=order.target_size,
        target_color=order.target_color,
        planned_quantity=order.planned_quantity,
        produced_quantity=order.produced_quantity,
        status=order.status,
        priority=order.priority,
        due_date=order.due_date,
        started_at=order.started_at,
        finished_at=order.finished_at,
        notes=order.notes,
        received_notes=order.received_notes,
        labor_cost=order.labor_cost,
        additional_cost=order.additional_cost,
        estimated_total_cost=order.estimated_total_cost,
        actual_total_cost=order.actual_total_cost,
        currency=order.currency,
        design_photo_url=order.design_photo_url,
    )


def build_material_response(
    db: Session,
    material: ProductionOrderMaterial,
) -> ProductionOrderMaterialResponse:
    roll = None
    trim = None

    if material.fabric_roll_id:
        roll = db.execute(
            select(FabricRoll).where(FabricRoll.id == material.fabric_roll_id)
        ).scalar_one_or_none()

    if material.trim_id:
        trim = db.execute(
            select(Trim).where(Trim.id == material.trim_id)
        ).scalar_one_or_none()

    description = material.description_snapshot or ""

    if roll:
        extra_name = ""
        try:
            fabric_name = getattr(getattr(roll, "fabric", None), "name", None)
            if fabric_name:
                extra_name = f" - {fabric_name}"
        except Exception:
            extra_name = ""
        description = f"Rollo {roll.roll_code}{extra_name}"

    if trim:
        description = f"Avío {trim.code} - {trim.name}"

    return ProductionOrderMaterialResponse(
        id=material.id,
        production_order_id=material.production_order_id,
        material_type=material.material_type,
        fabric_roll_id=material.fabric_roll_id,
        description_snapshot=description,
        planned_quantity=material.planned_quantity,
        delivered_quantity=material.delivered_quantity,
        consumed_quantity=material.consumed_quantity,
        returned_quantity=material.returned_quantity,
        waste_quantity=material.waste_quantity,
        unit=material.unit,
        unit_cost_snapshot=material.unit_cost_snapshot,
        notes=material.notes,
        roll_code=roll.roll_code if roll else (trim.code if trim else None),
        roll_current_length=roll.current_length if roll else (trim.current_stock if trim else None),
        roll_reserved_length=roll.reserved_length if roll else (trim.reserved_stock if trim else None),
        issued_at=material.issued_at,
        returned_at=material.returned_at,
    )


def _build_pdf_bytes(
    db: Session,
    order: ProductionOrder,
) -> bytes:
    """
    Genera un PDF simple y robusto, sin depender de templates HTML.
    Requiere reportlab instalado.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except Exception as exc:
        raise AppException(
            500,
            f"PDF generation dependency missing: {exc}",
            "PDF_DEPENDENCY_MISSING",
        )

    materials = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.production_order_id == order.id,
            ProductionOrderMaterial.tenant_id == order.tenant_id,
        )
    ).scalars().all()

    outputs = db.execute(
        select(ProductionOrderOutput).where(
            ProductionOrderOutput.production_order_id == order.id,
            ProductionOrderOutput.tenant_id == order.tenant_id,
        )
    ).scalars().all()

    workshop = None
    if order.workshop_supplier_id:
        workshop = db.execute(
            select(Supplier).where(
                Supplier.id == order.workshop_supplier_id,
                Supplier.tenant_id == order.tenant_id,
            )
        ).scalar_one_or_none()

    costs = calculate_order_costs(db, order)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    left = 40
    right = width - 40
    y = height - 40

    def new_page():
        nonlocal y
        pdf.showPage()
        y = height - 40

    def draw_line(text: str, size: int = 10, bold: bool = False, gap: int = 14):
        nonlocal y
        if y < 60:
            new_page()
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawString(left, y, str(text))
        y -= gap

    def draw_kv(label: str, value: str):
        draw_line(f"{label}: {value}", size=10, bold=False, gap=14)

    def hr():
        nonlocal y
        if y < 60:
            new_page()
        pdf.line(left, y, right, y)
        y -= 10

    draw_line("ORDEN DE PRODUCCIÓN", size=16, bold=True, gap=22)
    draw_kv("Número", order.order_number or "-")
    draw_kv("Taller", workshop.name if workshop else "-")
    draw_kv("Vestido / Producto", order.target_dress_name or "-")
    draw_kv("Código", order.target_dress_code or "-")
    draw_kv("Talle", order.target_size or "-")
    draw_kv("Color", order.target_color or "-")
    draw_kv("Cantidad planificada", str(order.planned_quantity or 0))
    draw_kv("Cantidad producida", str(order.produced_quantity or 0))
    draw_kv("Estado", order.status or "-")
    draw_kv("Prioridad", order.priority or "-")
    draw_kv("Vencimiento", _fmt_date(order.due_date))
    draw_kv("Inicio", _fmt_datetime(order.started_at))
    draw_kv("Finalización", _fmt_datetime(order.finished_at))
    if order.notes:
        draw_kv("Notas", order.notes)
    if order.received_notes:
        draw_kv("Notas de recepción", order.received_notes)

    y -= 6
    hr()

    draw_line("MATERIALES", size=12, bold=True, gap=18)
    if not materials:
        draw_line("Sin materiales asignados.", size=10)
    else:
        for idx, material in enumerate(materials, start=1):
            item = build_material_response(db, material)
            draw_line(f"{idx}. {item.description_snapshot or '-'}", size=10, bold=True)
            draw_kv("   Planificado", f"{_fmt_decimal(item.planned_quantity)} {item.unit or ''}".strip())
            draw_kv("   Entregado", f"{_fmt_decimal(item.delivered_quantity)} {item.unit or ''}".strip())
            draw_kv("   Consumido", f"{_fmt_decimal(item.consumed_quantity)} {item.unit or ''}".strip())
            draw_kv("   Devuelto", f"{_fmt_decimal(item.returned_quantity)} {item.unit or ''}".strip())
            draw_kv("   Desperdicio", f"{_fmt_decimal(item.waste_quantity)} {item.unit or ''}".strip())
            draw_kv("   Costo unitario", f"{costs['currency']} {_fmt_decimal(item.unit_cost_snapshot)}")
            if item.notes:
                draw_kv("   Notas", item.notes)
            y -= 4

    hr()

    draw_line("SALIDAS / PRODUCTO TERMINADO", size=12, bold=True, gap=18)
    if not outputs:
        draw_line("Sin outputs registrados.", size=10)
    else:
        for idx, output in enumerate(outputs, start=1):
            draw_line(
                f"{idx}. {output.name or '-'} | Código: {output.code or '-'} | Cantidad: {output.quantity or 0}",
                size=10,
                bold=False,
            )
            draw_kv("   Talle", output.size or "-")
            draw_kv("   Color", output.color or "-")
            draw_kv("   Costo unitario", f"{costs['currency']} {_fmt_decimal(output.unit_cost)}")
            if output.notes:
                draw_kv("   Notas", output.notes)
            y -= 4

    hr()

    draw_line("RESUMEN DE COSTOS", size=12, bold=True, gap=18)
    draw_kv("Costo materiales estimado", f"{costs['currency']} {_fmt_decimal(costs['estimated_material_cost'])}")
    draw_kv("Costo materiales real", f"{costs['currency']} {_fmt_decimal(costs['actual_material_cost'])}")
    draw_kv("Mano de obra", f"{costs['currency']} {_fmt_decimal(costs['labor_cost'])}")
    draw_kv("Costos adicionales", f"{costs['currency']} {_fmt_decimal(costs['additional_cost'])}")
    draw_kv("Costo total estimado", f"{costs['currency']} {_fmt_decimal(costs['estimated_total_cost'])}")
    draw_kv("Costo total real", f"{costs['currency']} {_fmt_decimal(costs['actual_total_cost'])}")
    draw_kv("Costo unitario estimado", f"{costs['currency']} {_fmt_decimal(costs['estimated_unit_cost'])}")
    draw_kv("Costo unitario real", f"{costs['currency']} {_fmt_decimal(costs['actual_unit_cost'])}")

    pdf.save()
    buffer.seek(0)
    return buffer.read()


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("")
def list_production_orders(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
):
    query = select(ProductionOrder).where(
        ProductionOrder.tenant_id == membership.tenant_id,
        ProductionOrder.deleted_at.is_(None),
    )

    if status:
        query = query.where(ProductionOrder.status == status)

    if search:
        like_value = f"%{search}%"
        query = query.where(
            or_(
                ProductionOrder.order_number.ilike(like_value),
                ProductionOrder.target_dress_name.ilike(like_value),
                ProductionOrder.target_dress_code.ilike(like_value),
            )
        )

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()

    rows = db.execute(
        query.order_by(ProductionOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [build_order_response(db, row).model_dump(mode="json") for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=ProductionOrderResponse)
def create_production_order(
    payload: ProductionOrderCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    workshop = db.execute(
        select(Supplier).where(
            Supplier.id == payload.workshop_supplier_id,
            Supplier.tenant_id == membership.tenant_id,
            Supplier.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not workshop:
        raise AppException(404, "Workshop supplier not found", "WORKSHOP_NOT_FOUND")

    if workshop.supplier_type not in {"WORKSHOP", "BOTH"}:
        raise AppException(400, "Supplier is not configured as workshop", "SUPPLIER_NOT_WORKSHOP")

    tenant_id = membership.tenant_id

    order_number = payload.order_number.strip() if payload.order_number else None

    if not order_number:
        order_number = get_next_code(db, tenant_id, "production_order")

    duplicate = db.execute(
        select(ProductionOrder).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.order_number == order_number,
            ProductionOrder.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if duplicate:
        raise AppException(400, "Order number already exists", "PRODUCTION_ORDER_DUPLICATE")

    order = ProductionOrder(
        tenant_id=membership.tenant_id,
        order_number=order_number,
        workshop_supplier_id=payload.workshop_supplier_id,
        target_dress_name=payload.target_dress_name,
        target_dress_code=payload.target_dress_code,
        target_size=payload.target_size,
        target_color=payload.target_color,
        planned_quantity=payload.planned_quantity,
        produced_quantity=0,
        priority=payload.priority,
        due_date=payload.due_date,
        notes=payload.notes,
        design_photo_url=payload.design_photo_url,
        created_by_user_id=membership.user_id,
        status="DRAFT",
        labor_cost=Decimal("0"),
        additional_cost=Decimal("0"),
        estimated_total_cost=Decimal("0"),
        actual_total_cost=Decimal("0"),
        currency="USD",
    )

    db.add(order)
    db.flush()

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order.id,
        created_by_user_id=membership.user_id,
        event_type="CREATED",
        payload={"order_number": order.order_number},
    )

    db.commit()
    db.refresh(order)
    return build_order_response(db, order)


@router.get("/{order_id}", response_model=ProductionOrderResponse)
def get_production_order(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    sync_order_totals(db, order)
    db.commit()
    db.refresh(order)

    return build_order_response(db, order)


@router.get("/{order_id}/cost-summary", response_model=ProductionOrderCostSummary)
def get_cost_summary(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)
    return ProductionOrderCostSummary(**calculate_order_costs(db, order))


@router.post("/{order_id}/costs", response_model=ProductionOrderResponse)
def update_costs(
    order_id: UUIDType,
    payload: ProductionOrderCostsUpdate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    order.labor_cost = payload.labor_cost
    order.additional_cost = payload.additional_cost
    order.currency = payload.currency

    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order.id,
        created_by_user_id=membership.user_id,
        event_type="COSTS_UPDATED",
        payload={
            "labor_cost": str(order.labor_cost),
            "additional_cost": str(order.additional_cost),
            "currency": order.currency,
        },
    )

    db.commit()
    db.refresh(order)
    return build_order_response(db, order)


@router.get("/{order_id}/materials")
def list_production_order_materials(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    rows = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.production_order_id == order_id,
            ProductionOrderMaterial.tenant_id == membership.tenant_id,
        )
    ).scalars().all()

    return [build_material_response(db, row).model_dump(mode="json") for row in rows]


@router.post("/{order_id}/materials/fabric", response_model=ProductionOrderMaterialResponse)
def add_fabric_material(
    order_id: UUIDType,
    payload: ProductionOrderMaterialAdd,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    roll = db.execute(
        select(FabricRoll).where(
            FabricRoll.id == payload.fabric_roll_id,
            FabricRoll.tenant_id == membership.tenant_id,
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not roll:
        raise AppException(404, "Fabric roll not found", "FABRIC_ROLL_NOT_FOUND")

    unit_cost_snapshot = getattr(roll, "cost_per_unit", None)

    material = ProductionOrderMaterial(
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        material_type="FABRIC_ROLL",
        fabric_roll_id=payload.fabric_roll_id,
        description_snapshot=f"Rollo {roll.roll_code}",
        planned_quantity=payload.planned_quantity,
        delivered_quantity=Decimal("0"),
        consumed_quantity=Decimal("0"),
        returned_quantity=Decimal("0"),
        waste_quantity=Decimal("0"),
        unit=payload.unit,
        unit_cost_snapshot=unit_cost_snapshot,
        notes=payload.notes,
    )

    db.add(material)
    db.flush()

    order = _get_order_or_404(db, membership.tenant_id, order_id)
    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="FABRIC_ASSIGNED",
        payload={
            "material_id": str(material.id),
            "roll_code": roll.roll_code,
            "unit_cost_snapshot": str(material.unit_cost_snapshot or 0),
        },
    )

    db.commit()
    db.refresh(material)
    return build_material_response(db, material)


@router.post("/{order_id}/materials/trim", response_model=ProductionOrderMaterialResponse)
def add_trim_material(
    order_id: UUIDType,
    trim_id: UUIDType,
    planned_quantity: Decimal,
    notes: str | None = None,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    trim = db.execute(
        select(Trim).where(
            Trim.id == trim_id,
            Trim.tenant_id == membership.tenant_id,
            Trim.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not trim:
        raise AppException(404, "Trim not found", "TRIM_NOT_FOUND")

    material = ProductionOrderMaterial(
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        material_type="TRIM",
        trim_id=trim_id,
        description_snapshot=f"Avío {trim.code} - {trim.name}",
        planned_quantity=planned_quantity,
        delivered_quantity=Decimal("0"),
        consumed_quantity=Decimal("0"),
        returned_quantity=Decimal("0"),
        waste_quantity=Decimal("0"),
        unit=trim.unit,
        unit_cost_snapshot=trim.unit_cost,
        notes=notes,
    )

    db.add(material)
    db.flush()

    order = _get_order_or_404(db, membership.tenant_id, order_id)
    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="TRIM_ASSIGNED",
        payload={
            "material_id": str(material.id),
            "trim_code": trim.code,
            "unit_cost_snapshot": str(material.unit_cost_snapshot or 0),
        },
    )

    db.commit()
    db.refresh(material)
    return build_material_response(db, material)


@router.post("/{order_id}/materials/{material_id}/reserve")
def reserve_material(
    order_id: UUIDType,
    material_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    material = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.id == material_id,
            ProductionOrderMaterial.production_order_id == order_id,
            ProductionOrderMaterial.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not material:
        raise AppException(404, "Material not found", "PRODUCTION_ORDER_MATERIAL_NOT_FOUND")

    planned = _decimal(material.planned_quantity)

    if material.material_type == "FABRIC_ROLL":
        roll = db.execute(
            select(FabricRoll).where(
                FabricRoll.id == material.fabric_roll_id,
                FabricRoll.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        free = _decimal(roll.current_length) - _decimal(roll.reserved_length)
        if planned > free:
            raise AppException(
                400,
                "Not enough available roll stock to reserve",
                "FABRIC_ROLL_NOT_ENOUGH_AVAILABLE_TO_RESERVE",
            )
        roll.reserved_length = _decimal(roll.reserved_length) + planned

    elif material.material_type == "TRIM":
        trim = db.execute(
            select(Trim).where(
                Trim.id == material.trim_id,
                Trim.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        free = _decimal(trim.current_stock) - _decimal(trim.reserved_stock)
        if planned > free:
            raise AppException(
                400,
                "Not enough available trim stock to reserve",
                "TRIM_NOT_ENOUGH_AVAILABLE_TO_RESERVE",
            )
        trim.reserved_stock = _decimal(trim.reserved_stock) + planned

    if order.status == "DRAFT":
        order.status = "MATERIALS_RESERVED"

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="MATERIAL_RESERVED",
        payload={"material_id": str(material.id), "material_type": material.material_type},
    )

    db.commit()
    return {"message": "Material reserved successfully"}


@router.post("/{order_id}/materials/{material_id}/issue")
def issue_material(
    order_id: UUIDType,
    material_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    material = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.id == material_id,
            ProductionOrderMaterial.production_order_id == order_id,
            ProductionOrderMaterial.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not material:
        raise AppException(404, "Material not found", "PRODUCTION_ORDER_MATERIAL_NOT_FOUND")

    planned = _decimal(material.planned_quantity)

    if _decimal(material.delivered_quantity) > 0:
        raise AppException(400, "Material already issued", "MATERIAL_ALREADY_ISSUED")

    if material.material_type == "FABRIC_ROLL":
        roll = db.execute(
            select(FabricRoll).where(
                FabricRoll.id == material.fabric_roll_id,
                FabricRoll.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        if planned > _decimal(roll.reserved_length):
            raise AppException(400, "Material must be reserved before issuing", "MATERIAL_NOT_RESERVED")
        if planned > _decimal(roll.current_length):
            raise AppException(400, "Not enough current stock", "FABRIC_ROLL_NOT_ENOUGH_CURRENT")

        roll.current_length = _decimal(roll.current_length) - planned
        roll.reserved_length = _decimal(roll.reserved_length) - planned
        roll.status = "DEPLETED" if _decimal(roll.current_length) == 0 else "AVAILABLE"

        db.add(
            FabricMovement(
                tenant_id=membership.tenant_id,
                fabric_roll_id=roll.id,
                type="OUT",
                quantity=planned,
                reference=f"Production Order {order.order_number}",
                notes=f"Issue fabric to production order material {material_id}",
                production_order_id=order_id,
                movement_reason="PRODUCTION_ISSUE",
            )
        )

    elif material.material_type == "TRIM":
        trim = db.execute(
            select(Trim).where(
                Trim.id == material.trim_id,
                Trim.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        if planned > _decimal(trim.reserved_stock):
            raise AppException(400, "Material must be reserved before issuing", "MATERIAL_NOT_RESERVED")
        if planned > _decimal(trim.current_stock):
            raise AppException(400, "Not enough current trim stock", "TRIM_NOT_ENOUGH_CURRENT")

        trim.current_stock = _decimal(trim.current_stock) - planned
        trim.reserved_stock = _decimal(trim.reserved_stock) - planned

        db.add(
            TrimMovement(
                tenant_id=membership.tenant_id,
                trim_id=trim.id,
                type="OUT",
                quantity=planned,
                reference=f"Production Order {order.order_number}",
                notes=f"Issue trim to production order material {material_id}",
                production_order_id=order_id,
                movement_reason="PRODUCTION_ISSUE",
                created_at=_now_utc(),
            )
        )

    material.delivered_quantity = planned
    material.issued_at = _now_utc()

    if order.status in {"DRAFT", "MATERIALS_RESERVED", "APPROVED"}:
        order.status = "IN_PRODUCTION"
        if not order.started_at:
            order.started_at = _now_utc()

    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="MATERIAL_ISSUED",
        payload={"material_id": str(material.id), "material_type": material.material_type},
    )

    db.commit()
    return {"message": "Material issued successfully"}


@router.post("/{order_id}/materials/{material_id}/return")
def return_material(
    order_id: UUIDType,
    material_id: UUIDType,
    payload: ProductionOrderMaterialReturn,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    material = db.execute(
        select(ProductionOrderMaterial).where(
            ProductionOrderMaterial.id == material_id,
            ProductionOrderMaterial.production_order_id == order_id,
            ProductionOrderMaterial.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not material:
        raise AppException(404, "Material not found", "PRODUCTION_ORDER_MATERIAL_NOT_FOUND")

    delivered = _decimal(material.delivered_quantity)
    already_returned = _decimal(material.returned_quantity)
    already_waste = _decimal(material.waste_quantity)
    new_return = _decimal(payload.returned_quantity)
    new_waste = _decimal(payload.waste_quantity)

    if (already_returned + already_waste + new_return + new_waste) > delivered:
        raise AppException(
            400,
            "Returned plus waste cannot exceed delivered quantity",
            "RETURN_EXCEEDS_DELIVERED",
        )

    material.returned_quantity = already_returned + new_return
    material.waste_quantity = already_waste + new_waste
    material.consumed_quantity = delivered - material.returned_quantity - material.waste_quantity
    material.returned_at = _now_utc()

    if payload.notes:
        material.notes = payload.notes

    if material.material_type == "FABRIC_ROLL" and new_return > 0:
        roll = db.execute(
            select(FabricRoll).where(
                FabricRoll.id == material.fabric_roll_id,
                FabricRoll.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        roll.current_length = _decimal(roll.current_length) + new_return
        roll.status = "AVAILABLE"

        db.add(
            FabricMovement(
                tenant_id=membership.tenant_id,
                fabric_roll_id=roll.id,
                type="IN",
                quantity=new_return,
                reference=f"Production Order {order.order_number}",
                notes=f"Return fabric from production order material {material_id}",
                production_order_id=order_id,
                movement_reason="PRODUCTION_RETURN",
            )
        )

    if material.material_type == "TRIM" and new_return > 0:
        trim = db.execute(
            select(Trim).where(
                Trim.id == material.trim_id,
                Trim.tenant_id == membership.tenant_id,
            )
        ).scalar_one()

        trim.current_stock = _decimal(trim.current_stock) + new_return

        db.add(
            TrimMovement(
                tenant_id=membership.tenant_id,
                trim_id=trim.id,
                type="IN",
                quantity=new_return,
                reference=f"Production Order {order.order_number}",
                notes=f"Return trim from production order material {material_id}",
                production_order_id=order_id,
                movement_reason="PRODUCTION_RETURN",
                created_at=_now_utc(),
            )
        )

    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="MATERIAL_RETURNED",
        payload={
            "material_id": str(material.id),
            "material_type": material.material_type,
            "returned_quantity": str(new_return),
            "waste_quantity": str(new_waste),
            "consumed_quantity": str(material.consumed_quantity),
        },
    )

    db.commit()
    return {"message": "Material return recorded successfully"}

@router.post("/{order_id}/receive", response_model=ProductionOrderResponse)
def receive_production_order(
    order_id: UUIDType,
    payload: ProductionOrderReceive,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    order.produced_quantity = payload.produced_quantity
    order.received_notes = payload.received_notes
    order.status = payload.status

    if payload.status == "COMPLETED":
        order.finished_at = _now_utc()

        # 🔥 CALCULAR COSTOS
        totals = calculate_order_costs(db, order)
        unit_cost = totals["actual_unit_cost"]

        # 🔥 CREAR VESTIDOS AUTOMÁTICAMENTE
        for i in range(payload.produced_quantity):
            dress_code = order.target_dress_code

            if not dress_code:
                dress_code = get_next_code(db, membership.tenant_id, "dress")

            else:
                # si hay más de uno, evitar duplicados
                if payload.produced_quantity > 1:
                    dress_code = f"{dress_code}-{i+1}"

            dress = Dress(
                tenant_id=membership.tenant_id,
                code=dress_code,
                name=order.target_dress_name,
                size=order.target_size,
                color=order.target_color,
                status="AVAILABLE",
                photo_url=order.design_photo_url,  # 🔥 IMAGEN
                sale_price=None,
                rental_price=None,
            )

            db.add(dress)

        # 🔥 CREAR OUTPUT AUTOMÁTICO
        output = ProductionOrderOutput(
            tenant_id=membership.tenant_id,
            production_order_id=order.id,
            name=order.target_dress_name,
            code=order.target_dress_code,
            size=order.target_size,
            color=order.target_color,
            quantity=payload.produced_quantity,
            unit_cost=unit_cost,
            notes="Generado automáticamente al completar la orden",
        )

        db.add(output)

    sync_order_totals(db, order)

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="ORDER_RECEIVED",
        payload={
            "produced_quantity": payload.produced_quantity,
            "status": payload.status,
        },
    )

    db.commit()
    db.refresh(order)
    return build_order_response(db, order)


@router.get("/{order_id}/outputs")
def list_outputs(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    rows = db.execute(
        select(ProductionOrderOutput).where(
            ProductionOrderOutput.production_order_id == order_id,
            ProductionOrderOutput.tenant_id == membership.tenant_id,
        )
    ).scalars().all()

    return [
        ProductionOrderOutputResponse.model_validate(row).model_dump(mode="json")
        for row in rows
    ]


@router.post("/{order_id}/outputs", response_model=ProductionOrderOutputResponse)
def create_output(
    order_id: UUIDType,
    payload: ProductionOrderOutputCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    dress_id = None

    if payload.create_dress_records:
        dress = Dress(
            tenant_id=membership.tenant_id,
            code=payload.code or f"PO-{str(order_id)[:8]}",
            name=payload.name,
            size=payload.size,
            color=payload.color,
            status="AVAILABLE",
        )
        db.add(dress)
        db.flush()
        dress_id = dress.id

    output = ProductionOrderOutput(
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        dress_id=dress_id,
        name=payload.name,
        code=payload.code,
        size=payload.size,
        color=payload.color,
        quantity=payload.quantity,
        unit_cost=payload.unit_cost,
        notes=payload.notes,
    )

    db.add(output)
    db.flush()

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order_id,
        created_by_user_id=membership.user_id,
        event_type="OUTPUT_CREATED",
        payload={
            "output_id": str(output.id),
            "name": output.name,
            "quantity": output.quantity,
        },
    )

    db.commit()
    db.refresh(output)
    return output


@router.get("/{order_id}/events")
def list_production_order_events(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    _get_order_or_404(db, membership.tenant_id, order_id)

    rows = db.execute(
        select(ProductionOrderEvent)
        .where(
            ProductionOrderEvent.production_order_id == order_id,
            ProductionOrderEvent.tenant_id == membership.tenant_id,
        )
        .order_by(ProductionOrderEvent.created_at.desc())
    ).scalars().all()

    return [
        ProductionOrderEventResponse.model_validate(row).model_dump(mode="json")
        for row in rows
    ]


@router.get("/{order_id}/pdf")
def download_production_order_pdf(
    order_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    # Recalcula antes de imprimir
    sync_order_totals(db, order)
    db.commit()
    db.refresh(order)

    pdf_bytes = _build_pdf_bytes(db, order)

    filename = f"production_order_{order.order_number or order.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )

@router.post("/{order_id}/design-image", response_model=ProductionOrderResponse)
def upload_design_image(
    order_id: UUIDType,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    order = _get_order_or_404(db, membership.tenant_id, order_id)

    if not file:
        raise AppException(400, "File is required", "FILE_REQUIRED")

    # 🔥 obtener tenant (igual que trims)
    tenant = db.execute(
        select(Tenant).where(Tenant.id == membership.tenant_id)
    ).scalar_one()

    # 🔥 subir a Cloudinary
    result = upload_image(
        file_obj=file.file,
        tenant_slug=tenant.slug,
        entity="production-orders",
        asset_key=order.order_number or str(order.id),
        overwrite=True,
    )

    # 🔥 guardar URL REAL
    order.design_photo_url = result["url"]

    create_order_event(
        db=db,
        tenant_id=membership.tenant_id,
        production_order_id=order.id,
        created_by_user_id=membership.user_id,
        event_type="DESIGN_IMAGE_UPDATED",
        payload={"design_photo_url": order.design_photo_url},
    )

    db.commit()
    db.refresh(order)

    return build_order_response(db, order)
