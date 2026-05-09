from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps_superadmin import require_superuser
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.tenant_currency import TenantCurrency
from app.api.deps import require_roles
from app.schemas.tenant_currency import (
    TenantCurrencyCreate,
    TenantCurrencyRead,
    TenantCurrencyUpdate,
)

router = APIRouter(
    prefix="/tenant-currencies",
    tags=["tenant-currencies"],
)


def ensure_tenant_exists(db: Session, tenant_id: UUID) -> Tenant:
    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    return tenant


@router.get(
    "/options",
)
def list_current_tenant_currencies(
    db: Session = Depends(get_db),
    membership=Depends(
        require_roles(
            "admin",
            "manager",
            "staff",
        )
    ),
):
    rows = db.execute(
        select(TenantCurrency)
        .where(
            TenantCurrency.tenant_id
            == membership.tenant_id,
            TenantCurrency.is_enabled.is_(True),
        )
        .order_by(
            TenantCurrency.display_order.asc(),
            TenantCurrency.currency_code.asc(),
        )
    ).scalars().all()

    return [
        {
            "currency_code": row.currency_code,
            "symbol": row.symbol,
            "is_base": row.is_base,
        }
        for row in rows
    ]



@router.get("/{tenant_id}", response_model=list[TenantCurrencyRead])
def list_tenant_currencies(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    rows = db.execute(
        select(TenantCurrency)
        .where(TenantCurrency.tenant_id == tenant_id)
        .order_by(
            TenantCurrency.display_order,
            TenantCurrency.currency_code,
        )
    ).scalars().all()

    return rows


@router.post("/{tenant_id}", response_model=TenantCurrencyRead)
def create_tenant_currency(
    tenant_id: UUID,
    payload: TenantCurrencyCreate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    currency_code = payload.currency_code.upper()

    existing = db.execute(
        select(TenantCurrency).where(
            TenantCurrency.tenant_id == tenant_id,
            TenantCurrency.currency_code == currency_code,
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Currency already exists for this tenant.",
        )

    if payload.is_base:
        db.execute(
            TenantCurrency.__table__.update()
            .where(TenantCurrency.tenant_id == tenant_id)
            .values(is_base=False)
        )

    currency = TenantCurrency(
        tenant_id=tenant_id,
        currency_code=currency_code,
        symbol=payload.symbol,
        is_base=payload.is_base,
        is_enabled=payload.is_enabled,
        display_order=payload.display_order,
    )

    db.add(currency)
    db.commit()
    db.refresh(currency)

    return currency


@router.put("/{tenant_id}/{currency_id}", response_model=TenantCurrencyRead)
def update_tenant_currency(
    tenant_id: UUID,
    currency_id: UUID,
    payload: TenantCurrencyUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    currency = db.execute(
        select(TenantCurrency).where(
            TenantCurrency.id == currency_id,
            TenantCurrency.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not currency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Currency not found.",
        )

    data = payload.model_dump(exclude_unset=True)

    if data.get("is_base") is True:
        db.execute(
            TenantCurrency.__table__.update()
            .where(TenantCurrency.tenant_id == tenant_id)
            .values(is_base=False)
        )

    for key, value in data.items():
        setattr(currency, key, value)

    db.commit()
    db.refresh(currency)

    return currency


@router.delete("/{tenant_id}/{currency_id}")
def delete_tenant_currency(
    tenant_id: UUID,
    currency_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    currency = db.execute(
        select(TenantCurrency).where(
            TenantCurrency.id == currency_id,
            TenantCurrency.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not currency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Currency not found.",
        )

    if currency.is_base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Base currency cannot be deleted.",
        )

    db.delete(currency)
    db.commit()

    return {"ok": True}

