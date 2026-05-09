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
from app.models.customer import Customer
from app.models.dress import Dress
from app.models.loan import Loan
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.sale_payment import SalePayment
from app.schemas.sale import (
    SaleCancel,
    SaleCreate,
    SaleItemResponse,
    SaleListResponse,
    SalePaymentResponse,
    SaleResponse,
)
from app.services.sequences import get_next_code

router = APIRouter(prefix="/sales-unified", tags=["sales-unified"])


def build_sale_response(db: Session, sale: Sale) -> SaleResponse:
    customer = None
    if sale.customer_id:
        customer = db.execute(
            select(Customer).where(Customer.id == sale.customer_id)
        ).scalar_one_or_none()

    items = db.execute(
        select(SaleItem).where(
            SaleItem.sale_id == sale.id,
            SaleItem.tenant_id == sale.tenant_id,
        )
    ).scalars().all()

    payments = db.execute(
        select(SalePayment).where(
            SalePayment.sale_id == sale.id,
            SalePayment.tenant_id == sale.tenant_id,
        )
    ).scalars().all()

    return SaleResponse(
        id=sale.id,
        tenant_id=sale.tenant_id,
        sale_number=sale.sale_number,
        customer_id=sale.customer_id,
        customer_full_name=getattr(customer, "full_name", None) or (
            f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
            if customer else None
        ),
        sale_date=sale.sale_date,
        currency=sale.currency,
        status=sale.status,
        subtotal_amount=sale.subtotal_amount,
        discount_amount=sale.discount_amount,
        total_amount=sale.total_amount,
        notes=sale.notes,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=[SaleItemResponse.model_validate(item) for item in items],
        payments=[SalePaymentResponse.model_validate(payment) for payment in payments],
    )


def get_sale_or_404(db: Session, tenant_id: UUID, sale_id: UUID) -> Sale:
    sale = db.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    return sale


@router.get("", response_model=SaleListResponse)
def list_sales(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = select(Sale).where(Sale.tenant_id == tenant_id)

    if status_filter:
        stmt = stmt.where(Sale.status == status_filter)

    if date_from:
        stmt = stmt.where(Sale.sale_date >= date_from)

    if date_to:
        stmt = stmt.where(Sale.sale_date <= date_to)

    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Sale.sale_number.ilike(pattern),
                Sale.notes.ilike(pattern),
            )
        )

    count_stmt = select(func.count()).select_from(Sale).where(Sale.tenant_id == tenant_id)

    if status_filter:
        count_stmt = count_stmt.where(Sale.status == status_filter)
    if date_from:
        count_stmt = count_stmt.where(Sale.sale_date >= date_from)
    if date_to:
        count_stmt = count_stmt.where(Sale.sale_date <= date_to)

    total = db.execute(count_stmt).scalar_one()

    rows = db.execute(
        stmt.order_by(desc(Sale.sale_date), desc(Sale.created_at))
        .offset(offset)
        .limit(limit)
    ).scalars().all()

    return {
        "items": [build_sale_response(db, sale) for sale in rows],
        "total": total,
    }


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    sale = get_sale_or_404(db, membership.tenant_id, sale_id)
    return build_sale_response(db, sale)


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un item")

    if not payload.payments:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un pago")

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

    subtotal = Decimal("0.00")
    sale_items_to_create: list[dict] = []

    for item in payload.items:
        item_type = item.item_type.upper().strip()

        if item_type == "DRESS":
            if not item.dress_id:
                raise HTTPException(status_code=400, detail="Falta dress_id en item de vestido")
            if item.quantity != 1:
                raise HTTPException(status_code=400, detail="La cantidad para vestidos debe ser 1")

            dress = db.execute(
                select(Dress).where(
                    Dress.id == item.dress_id,
                    Dress.tenant_id == tenant_id,
                    Dress.deleted_at.is_(None),
                )
            ).scalar_one_or_none()

            if not dress:
                raise HTTPException(status_code=404, detail="Vestido no encontrado")

            if getattr(dress, "status", None) == "SOLD":
                raise HTTPException(status_code=400, detail="El vestido ya fue vendido")

            active_loan = db.execute(
                select(Loan).where(
                    Loan.tenant_id == tenant_id,
                    Loan.dress_id == item.dress_id,
                    Loan.status.in_(["ACTIVE", "LATE"]),
                )
            ).scalar_one_or_none()

            if active_loan:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede vender un vestido con préstamo/alquiler activo o vencido",
                )

            line_total = Decimal(str(item.unit_price)) * Decimal(str(item.quantity))
            subtotal += line_total

            sale_items_to_create.append(
                {
                    "item_type": "DRESS",
                    "dress_id": dress.id,
                    "accessory_id": None,
                    "code_snapshot": getattr(dress, "code", None),
                    "description_snapshot": getattr(dress, "name", None) or "Vestido",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "currency": item.currency or payload.currency or "ARS",
                    "line_total": line_total,
                    "notes": item.notes,
                    "dress": dress,
                    "accessory": None,
                }
            ) 

        elif item_type == "ACCESSORY":
            if not item.accessory_id:
                raise HTTPException(status_code=400, detail="Falta accessory_id en item de accesorio")

            accessory = db.execute(
                select(Accessory).where(
                    Accessory.id == item.accessory_id,
                    Accessory.tenant_id == tenant_id,
                    Accessory.deleted_at.is_(None),
                )
            ).scalar_one_or_none()

            if not accessory:
                raise HTTPException(status_code=404, detail="Accesorio no encontrado")

            if int(accessory.stock or 0) < item.quantity:
                raise HTTPException(status_code=400, detail="Stock insuficiente para el accesorio")

            line_total = Decimal(str(item.unit_price)) * Decimal(str(item.quantity))
            subtotal += line_total
            
            sale_items_to_create.append(
                {
                    "item_type": "ACCESSORY",
                    "dress_id": None,
                    "accessory_id": accessory.id,
                    "code_snapshot": getattr(accessory, "code", None),
                    "description_snapshot": getattr(accessory, "name", None) or "Accesorio",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "currency": item.currency or payload.currency or "ARS",
                    "line_total": line_total,
                    "notes": item.notes,
                    "dress": None,
                    "accessory": accessory,
                }
            ) 
        else:
            raise HTTPException(status_code=400, detail=f"Tipo de item inválido: {item.item_type}")

    discount_amount = Decimal(str(payload.discount_amount or 0))
    total_amount = subtotal - discount_amount

    if total_amount < 0:
        raise HTTPException(status_code=400, detail="El descuento no puede superar el subtotal")

    subtotal_ars = Decimal("0.00")
    subtotal_usd = Decimal("0.00")

    for item in sale_items_to_create:
        if item["item_type"] == "DRESS" or item["item_type"] == "ACCESSORY":
            currency = item.get("currency", payload.currency or "ARS")

            currency = str(currency or "ARS").upper()

            if currency == "USD":
                subtotal_usd += item["line_total"]
            elif currency == "EUR":
                subtotal_usd += item["line_total"]
            else:
                subtotal_ars += item["line_total"]
                paid_ars = Decimal("0.00")
                paid_usd = Decimal("0.00")

    for payment in payload.payments:
        if (payment.currency or "ARS") == "USD":
            paid_usd += Decimal(str(payment.amount))
        else:
            paid_ars += Decimal(str(payment.amount))

    balance_ars = subtotal_ars - paid_ars
    balance_usd = subtotal_usd - paid_usd

# NO exigimos igualdad total → permitimos multimoneda real

    sale_number = get_next_code(db, tenant_id, "sale")

    sale = Sale(
        tenant_id=tenant_id,
        sale_number=sale_number,
        customer_id=payload.customer_id,
        sale_date=payload.sale_date or datetime.utcnow(),
        currency=payload.currency or "ARS",
        status="COMPLETED",
        subtotal_amount=subtotal,
        discount_amount=discount_amount,
        total_amount=total_amount,
        notes=payload.notes,
    )

    db.add(sale)
    db.flush()

    for item_data in sale_items_to_create:
        sale_item = SaleItem(
            tenant_id=tenant_id,
            sale_id=sale.id,
            item_type=item_data["item_type"],
            dress_id=item_data["dress_id"],
            accessory_id=item_data["accessory_id"],
            code_snapshot=item_data["code_snapshot"],
            description_snapshot=item_data["description_snapshot"],
            quantity=item_data["quantity"],
            currency=item_data["currency"],
            unit_price=item_data["unit_price"],
            line_total=item_data["line_total"],
            notes=item_data.get("notes"),
        )
        db.add(sale_item)

        if item_data["dress"] is not None:
            item_data["dress"].status = "SOLD"
            db.add(item_data["dress"])

        if item_data["accessory"] is not None:
            item_data["accessory"].stock -= item_data["quantity"]
            item_data["accessory"].updated_at = datetime.utcnow()
            db.add(item_data["accessory"])

    for payment in payload.payments:
        sale_payment = SalePayment(
            tenant_id=tenant_id,
            sale_id=sale.id,
            payment_method=payment.payment_method,
            amount=payment.amount,
            currency=payment.currency or payload.currency or "ARS",
            reference=payment.reference,
            notes=payment.notes,
        )
        db.add(sale_payment)

    db.commit()
    db.refresh(sale)

    return build_sale_response(db, sale)


@router.post("/{sale_id}/cancel", response_model=SaleResponse)
def cancel_sale(
    sale_id: UUID,
    payload: SaleCancel,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    sale = get_sale_or_404(db, tenant_id, sale_id)

    if sale.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="La venta ya está cancelada")

    items = db.execute(
        select(SaleItem).where(
            SaleItem.sale_id == sale.id,
            SaleItem.tenant_id == tenant_id,
        )
    ).scalars().all()

    for item in items:
        if item.item_type == "DRESS" and item.dress_id:
            dress = db.execute(
                select(Dress).where(
                    Dress.id == item.dress_id,
                    Dress.tenant_id == tenant_id,
                )
            ).scalar_one_or_none()

            if dress and getattr(dress, "status", None) == "SOLD":
                dress.status = "AVAILABLE"
                db.add(dress)

        elif item.item_type == "ACCESSORY" and item.accessory_id:
            accessory = db.execute(
                select(Accessory).where(
                    Accessory.id == item.accessory_id,
                    Accessory.tenant_id == tenant_id,
                    Accessory.deleted_at.is_(None),
                )
            ).scalar_one_or_none()

            if accessory:
                accessory.stock += int(item.quantity or 0)
                accessory.updated_at = datetime.utcnow()
                db.add(accessory)

    sale.status = "CANCELLED"
    sale.cancelled_at = datetime.utcnow()
    sale.notes = f"{sale.notes or ''}\n\n[CANCELADA] {payload.reason or ''}".strip()
    sale.updated_at = datetime.utcnow()

    db.add(sale)
    db.commit()
    db.refresh(sale)

    return build_sale_response(db, sale)
