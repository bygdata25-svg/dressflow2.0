from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.accessory import Accessory
from app.models.accessory_sale import AccessorySale
from app.models.customer import Customer
from app.schemas.accessory_sale import (
    AccessorySaleCancel,
    AccessorySaleCreate,
    AccessorySaleResponse,
    PaginatedAccessorySaleResponse,
)
from app.services.sequences import get_next_code

router = APIRouter(prefix="/accessory-sales", tags=["accessory-sales"])


def build_accessory_sale_response(
    sale: AccessorySale,
    accessory: Accessory | None = None,
    customer: Customer | None = None,
) -> AccessorySaleResponse:
    return AccessorySaleResponse(
        id=sale.id,
        tenant_id=sale.tenant_id,
        sale_number=getattr(sale, "sale_number", None),
        accessory_id=sale.accessory_id,
        customer_id=sale.customer_id,
        sale_date=sale.sale_date,
        quantity=sale.quantity,
        unit_price=sale.unit_price,
        total_price=sale.total_price,
        currency=sale.currency,
        payment_method=sale.payment_method,
        notes=sale.notes,
        status=sale.status,
        accessory_code=getattr(accessory, "code", None),
        accessory_name=getattr(accessory, "name", None),
        customer_full_name=getattr(customer, "full_name", None) or (
            f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
            if customer else None
        ),
        created_at=sale.created_at,
        updated_at=sale.updated_at,
    )


def get_sale_or_404(db: Session, tenant_id: UUID, sale_id: UUID) -> AccessorySale:
    sale = db.execute(
        select(AccessorySale).where(
            AccessorySale.id == sale_id,
            AccessorySale.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not sale:
        raise HTTPException(status_code=404, detail="Venta de accesorio no encontrada")

    return sale


@router.get("", response_model=PaginatedAccessorySaleResponse)
def list_accessory_sales(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    payment_method: str | None = Query(default=None),
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

    count_stmt = select(func.count()).select_from(AccessorySale).where(
        AccessorySale.tenant_id == tenant_id
    )

    if status_filter:
        count_stmt = count_stmt.where(AccessorySale.status == status_filter)

    if payment_method:
        count_stmt = count_stmt.where(AccessorySale.payment_method == payment_method)

    total = db.execute(count_stmt).scalar_one()

    rows = db.execute(
        stmt.order_by(desc(AccessorySale.sale_date), desc(AccessorySale.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [
            build_accessory_sale_response(sale, accessory, customer)
            for sale, accessory, customer in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{sale_id}", response_model=AccessorySaleResponse)
def get_accessory_sale(
    sale_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    sale = get_sale_or_404(db, tenant_id, sale_id)

    accessory = db.execute(
        select(Accessory).where(Accessory.id == sale.accessory_id)
    ).scalar_one_or_none()

    customer = None
    if sale.customer_id:
        customer = db.execute(
            select(Customer).where(Customer.id == sale.customer_id)
        ).scalar_one_or_none()

    return build_accessory_sale_response(sale, accessory, customer)


@router.post("", response_model=AccessorySaleResponse, status_code=status.HTTP_201_CREATED)
def create_accessory_sale(
    payload: AccessorySaleCreate,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    accessory = db.execute(
        select(Accessory).where(
            Accessory.id == payload.accessory_id,
            Accessory.tenant_id == tenant_id,
            Accessory.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not accessory:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")

    if accessory.stock < payload.quantity:
        raise HTTPException(status_code=400, detail="Stock insuficiente para la venta")

    customer = None
    if payload.customer_id:
        customer = db.execute(
            select(Customer).where(
                Customer.id == payload.customer_id,
                Customer.tenant_id == tenant_id,
            )
        ).scalar_one_or_none()

        if not customer:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

    unit_price = payload.unit_price if payload.unit_price is not None else accessory.sale_price
    total_price = Decimal(str(unit_price)) * Decimal(str(payload.quantity))
    sale_number = get_next_code(db, tenant_id, "sale")

    sale = AccessorySale(
        tenant_id=tenant_id,
        sale_number=sale_number,
        accessory_id=payload.accessory_id,
        customer_id=payload.customer_id,
        sale_date=payload.sale_date or datetime.utcnow(),
        quantity=payload.quantity,
        unit_price=unit_price,
        total_price=total_price,
        currency=payload.currency or "ARS",
        payment_method=payload.payment_method,
        notes=payload.notes,
        status="COMPLETED",
    )

    accessory.stock -= payload.quantity
    accessory.updated_at = datetime.utcnow()

    db.add(sale)
    db.add(accessory)
    db.commit()
    db.refresh(sale)

    return build_accessory_sale_response(sale, accessory, customer)


@router.post("/{sale_id}/cancel", response_model=AccessorySaleResponse)
def cancel_accessory_sale(
    sale_id: UUID,
    payload: AccessorySaleCancel,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    sale = get_sale_or_404(db, tenant_id, sale_id)

    if sale.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="La venta ya está cancelada")

    accessory = db.execute(
        select(Accessory).where(
            Accessory.id == sale.accessory_id,
            Accessory.tenant_id == tenant_id,
            Accessory.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    sale.status = "CANCELLED"
    sale.notes = f"{sale.notes or ''}\n\n[CANCELADA] {payload.reason or ''}".strip()
    sale.updated_at = datetime.utcnow()

    if accessory:
        accessory.stock += sale.quantity
        accessory.updated_at = datetime.utcnow()
        db.add(accessory)

    db.add(sale)
    db.commit()
    db.refresh(sale)

    customer = None
    if sale.customer_id:
        customer = db.execute(
            select(Customer).where(Customer.id == sale.customer_id)
        ).scalar_one_or_none()

    return build_accessory_sale_response(sale, accessory, customer)
