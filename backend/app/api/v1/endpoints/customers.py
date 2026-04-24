from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    PaginatedCustomerResponse,
)
from app.services.sequences import get_next_code

router = APIRouter(prefix="/customers", tags=["customers"])


def get_customer_or_404(db: Session, tenant_id: UUID, customer_id: UUID) -> Customer:
    customer = db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.tenant_id == tenant_id,
            Customer.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return customer


@router.get("", response_model=PaginatedCustomerResponse)
def list_customers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = select(Customer).where(
        Customer.tenant_id == tenant_id,
        Customer.deleted_at.is_(None),
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Customer.code.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                Customer.email.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.notes.ilike(pattern),
                Customer.tax_id.ilike(pattern),  # 🔥 NUEVO
            )
        )

    count_stmt = select(func.count()).select_from(Customer).where(
        Customer.tenant_id == tenant_id,
        Customer.deleted_at.is_(None),
    )

    if search:
        pattern = f"%{search.strip()}%"
        count_stmt = count_stmt.where(
            or_(
                Customer.code.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                Customer.email.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.notes.ilike(pattern),
                Customer.tax_id.ilike(pattern),  # 🔥 NUEVO
            )
        )

    total = db.execute(count_stmt).scalar_one()

    items = db.execute(
        stmt.order_by(Customer.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    customer = get_customer_or_404(db, membership.tenant_id, customer_id)
    return customer


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    code = payload.code.strip() if payload.code else None

    if not code:
        code = get_next_code(db, tenant_id, "customer")

    existing = db.execute(
        select(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.code == code,
            Customer.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un cliente con ese código",
        )

    customer = Customer(
        tenant_id=tenant_id,
        code=code,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        notes=payload.notes.strip() if payload.notes else None,
        tax_id=payload.tax_id.strip() if payload.tax_id else None,  # 🔥 NUEVO
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    customer = get_customer_or_404(db, tenant_id, customer_id)

    data = payload.model_dump(exclude_unset=True)

    if "code" in data:
        new_code = data["code"].strip() if data["code"] else None

        if new_code:
            existing = db.execute(
                select(Customer).where(
                    Customer.tenant_id == tenant_id,
                    Customer.code == new_code,
                    Customer.id != customer_id,
                    Customer.deleted_at.is_(None),
                )
            ).scalar_one_or_none()

            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un cliente con ese código",
                )

        customer.code = new_code

    if "first_name" in data and data["first_name"] is not None:
        customer.first_name = data["first_name"].strip()

    if "last_name" in data and data["last_name"] is not None:
        customer.last_name = data["last_name"].strip()

    if "email" in data:
        customer.email = data["email"].strip() if data["email"] else None

    if "phone" in data:
        customer.phone = data["phone"].strip() if data["phone"] else None

    if "notes" in data:
        customer.notes = data["notes"].strip() if data["notes"] else None

    if "tax_id" in data:  # 🔥 NUEVO
        customer.tax_id = data["tax_id"].strip() if data["tax_id"] else None

    customer.updated_at = datetime.utcnow()

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    customer = get_customer_or_404(db, membership.tenant_id, customer_id)

    customer.deleted_at = datetime.utcnow()
    customer.updated_at = datetime.utcnow()

    db.add(customer)
    db.commit()

    return None
